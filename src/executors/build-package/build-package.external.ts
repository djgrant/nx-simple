import fse from "fs-extra";
import { getProjectDependencies } from "utils/nx.deps";
import { runTask } from "utils/nx.tasks";
import { createPackageJson } from "utils/package";
import { Options, Context } from "./build-package.types";
import { getConfig } from "./build-package.config";

/**
 * @description
 *  Compiles layers for project and each of its unpublishable dependencies.
 *  Packages dependent layers into output and emits a package.json for publishing.
 */
export async function runExternalExecutor(
  options: Required<Options>,
  context: Context
) {
  const cfg = getConfig(options, context);
  const outDir = `${cfg.workspaceDistDir}/${context.projectName}`;
  const layerDir = `${cfg.layersDir}/${context.projectName}`;
  const tmpOutDir = `${cfg.tmpDir}/${context.projectName}`;

  // 1. Get project dependencies
  const deps = await getProjectDependencies(
    context.projectGraph,
    context.projectName,
    context.root
  );

  // 2. Compile current layer
  // Todo does this need be inlined because of path mapping?
  console.log(`Building layer for ${context.projectName}...`);

  await runTask({
    project: context.projectName,
    target: context.targetName,
    cwd: context.root,
    overrides: {
      distribution: "layer",
      targetRuntime: options.targetRuntime,
    },
    logger: context.isVerbose ? console.log : undefined,
  });

  await fse.copy(layerDir, tmpOutDir);

  // 3. Compile non-publishable projects
  if (deps.unpublished.length) {
    const tasks: Promise<void>[] = [];

    try {
      for (const dep of deps.unpublished) {
        console.log(`Building layer for dependency ${dep.name}...`);

        const task = runTask({
          project: dep.name,
          target: "build", // todo find name of target – prefer distribution=external
          cwd: context.root,
          overrides: {
            distribution: "layer",
            targetRuntime: options.targetRuntime,
          },
          logger: context.isVerbose ? console.log : undefined,
        }).then(async () => {
          // 3a. Copy layer to publishable distribution
          await fse.copy(
            `${cfg.layersDir}/${dep.name}`,
            `${tmpOutDir}/layers/${dep.name}`
          );
        });

        tasks.push(task);
      }

      await Promise.all(tasks);
    } catch (err) {
      console.log(err);
      return { success: false };
    }
  }

  // 4. Create package.json
  await createPackageJson({
    projectDir: cfg.projectDir,
    outDir: tmpOutDir,
    entryModuleName: cfg.entryModuleName,
    dependencies: deps.published,
  });

  // 5. Move to publish directory
  await fse.remove(outDir);
  await fse.move(tmpOutDir, outDir);

  // 6. Cleanup
  await fse.remove(cfg.tmpDir);

  return { success: true };
}
