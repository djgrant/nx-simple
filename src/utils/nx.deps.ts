import type {
  ProjectGraph,
  ProjectGraphDependency,
  ProjectGraphProjectNode,
  ProjectGraphExternalNode,
  TargetConfiguration,
} from "@nrwl/devkit";
import path from "node:path";
import fse from "fs-extra";
import {
  projectIsBuildable,
  projectIsPublishable,
  projectIsPackagableLib,
} from "./contracts";

export type NxSimpleNode = ProjectGraphProjectNode & {
  targets?: Record<string, TargetConfiguration<any>>;
} & {
  buildable: boolean;
  publishable: boolean;
  packagable: boolean;
  packageName?: string;
  version?: string;
};

export const getPackageName = (node: NxSimpleNode | ProjectGraphExternalNode) =>
  node.type === "npm" ? node.data.packageName : node.packageName;

export const getVersion = (node: NxSimpleNode | ProjectGraphExternalNode) =>
  node.type === "npm" ? node.data.version : node.version;

export async function getProjectDependencies(
  projectGraph: ProjectGraph,
  projectName: string,
  root: string
) {
  const unpublished: NxSimpleNode[] = [];
  const published: (NxSimpleNode | ProjectGraphExternalNode)[] = [];

  await walkDependencies(
    projectGraph,
    projectName,
    (node) => {
      return !nodeIsExternal(node) && !projectIsPublishable(node);
    },
    async ({ node }) => {
      if (nodeIsExternal(node)) {
        published.push(node);
        return;
      }

      const buildable = projectIsBuildable(node);
      const publishable = projectIsPublishable(node);
      const packagable = projectIsPackagableLib(node);

      if (!publishable && !buildable && !packagable) {
        throw new Error(
          [
            `${node.name} cannot be packaged as a dependency. To resolve, either:`,
            `1. Inform nx-simple that this project will be published to NPM by adding a "publish" target or set "willPublish" to "true" in project.json`,
            `2. Add a build target using the executor "nx-simple:build"`,
            `3. Add package target using the executor "nx-simple:package" and set "distribution" option to "lib"`,
          ].join("\n")
        );
      }

      const packageJson = await getProjectPackageJson(node, root);
      const projectNode = {
        ...node,
        buildable,
        publishable,
        packagable,
        packageName: packageJson?.name,
        version: packageJson?.version,
      };

      if (publishable) {
        published.push(projectNode);
      } else {
        unpublished.push(projectNode);
      }
    }
  );

  return { published, unpublished };
}

type WalkerOpts = {
  dependency: ProjectGraphDependency;
  node: ProjectGraphProjectNode | ProjectGraphExternalNode;
  depth: number;
};

async function walkDependencies(
  projectGraph: ProjectGraph,
  projectName: string,
  shouldRecurse: (node: WalkerOpts["node"]) => boolean,
  walker: (opts: WalkerOpts) => void | Promise<void>
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
      const node = projectNode || externalNode;
      const shouldIgnore = target.startsWith("npm:") && !externalNode; // https://github.com/nrwl/nx/blob/2cddd68595fc9308fb3f4d937f1e3f2b8adcf92d/packages/workspace/src/utilities/buildable-libs-utils.ts#L131-L132

      if (shouldIgnore) continue;

      if (!node) {
        throw new Error(`Unable to find ${target} in project graph.`);
      }

      const walkerOpts = {
        dependency,
        depth,
        node,
      };

      const task = walker(walkerOpts);

      walkerTasks.push(task);

      if (shouldRecurse(node)) {
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

function nodeIsExternal(
  node?: ProjectGraphProjectNode | ProjectGraphExternalNode
): node is ProjectGraphExternalNode {
  return node?.type === "npm";
}

function nodeIsProject(
  node?: ProjectGraphProjectNode | ProjectGraphExternalNode
): node is ProjectGraphProjectNode {
  return node?.type !== "npm";
}
