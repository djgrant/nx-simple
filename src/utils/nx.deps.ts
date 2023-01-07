import type {
  ProjectGraph,
  ProjectGraphDependency,
  ProjectGraphProjectNode,
  ProjectGraphExternalNode,
} from "@nrwl/devkit";
import path from "node:path";
import fse from "fs-extra";
import { projectIsBuildable, projectIsPublishable } from "./contracts";

export type ProjectNode = (
  | (ProjectGraphProjectNode & { external: false })
  | (ProjectGraphExternalNode & { external: true })
) & {
  buildable: boolean;
  publishable: boolean;
  packageName?: string;
};

export async function getProjectDependencies(
  projectGraph: ProjectGraph,
  projectName: string,
  root: string
) {
  const unpublished: ProjectNode[] = [];
  const published: ProjectNode[] = [];

  await walkDependencies(
    projectGraph,
    projectName,
    async ({ dependency, node }) => {
      if (!node.external && !node.publishable && !node.buildable) {
        throw new Error(
          `Dependency ${dependency.target} is not registered as published and can't be built by nx-simple`
        );
      }

      if (node.external) {
        published.push({ ...node, packageName: node.data.packageName });
        return;
      }

      const packageJson = await getProjectPackageJson(node, root);
      const projectNode = { ...node, packageName: packageJson?.name };

      if (node.publishable) {
        published.push(projectNode);
      } else {
        unpublished.push(projectNode);
      }
    }
  );

  return { published, unpublished };
}

async function walkDependencies(
  projectGraph: ProjectGraph,
  projectName: string,
  walker: (opts: {
    dependency: ProjectGraphDependency;
    node: ProjectNode;
    depth: number;
  }) => void | Promise<void>
) {
  const walkerTasks: (void | Promise<void>)[] = [];

  function walk(currentProject = projectName, visited = new Set(), depth = 0) {
    const projectDeps = projectGraph.dependencies[currentProject] || [];

    for (const dependency of projectDeps) {
      const target = dependency.target;

      if (visited.has(target)) continue;
      visited.add(target);

      const externalNode = projectGraph.externalNodes![target];
      const projectNode = projectGraph.nodes[target];
      const buildable = projectIsBuildable(projectNode);
      const publishable = projectIsPublishable(projectNode);
      const shouldIgnore = target.startsWith("npm:") && !externalNode; // https://github.com/nrwl/nx/blob/2cddd68595fc9308fb3f4d937f1e3f2b8adcf92d/packages/workspace/src/utilities/buildable-libs-utils.ts#L131-L132

      if (shouldIgnore) continue;

      if (!projectNode && !externalNode) {
        throw new Error(`Unable to find ${target} in project graph.`);
      }

      const task = walker({
        dependency,
        depth,
        node: {
          buildable,
          publishable,
          ...(projectNode
            ? { ...projectNode, external: false }
            : { ...externalNode!, external: true }),
        },
      });

      walkerTasks.push(task);

      if (!externalNode && !publishable) {
        walk(target, visited, depth + 1);
      }
    }
  }

  walk();
  await Promise.all(walkerTasks);
}

async function getProjectPackageJson(
  node: ProjectGraphProjectNode,
  root: string
): Promise<null | Record<string, any>> {
  const libPackageJsonPath = path.join(root, node.data.root, "package.json");

  const packageJson = await fse.readJson(libPackageJsonPath, {
    throws: false,
  });

  return packageJson;
}
