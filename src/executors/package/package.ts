import path from "node:path";
import fse from "fs-extra";
import { getConfig } from "utils/config";
import { createPackageJson } from "utils/package-json";
import { getProjectDependencies } from "utils/nx.deps";
import { Options, Context } from "./package.types";
import { buildLayer } from "./package.layer";

export default async function packageExecutor(
  options: Options,
  context: Context
) {
  const cfg = getConfig(options, context);
  const outDir = path.join(cfg.workspaceDistDir, context.projectName);
  const layerDir = path.join(cfg.layersDir, context.projectName);
  const tmpOutDir = path.join(cfg.tmpDir, context.projectName);

  // 1. Get project dependencies
  const deps = await getProjectDependencies(
    context.projectGraph,
    context.projectName,
    context.root
  );

  // 2. Compile current layer
  console.log(`Building layer for ${context.projectName}...`);

  await buildLayer(cfg);
  await fse.copy(layerDir, tmpOutDir);

  // 3. Copy non-publishable builds to publishable distribution
  if (deps.unpublished.length) {
    try {
      for (const dep of deps.unpublished) {
        // 3a. Build sub package programatically if project does not have a package executor
        if (!dep.packagable) {
          // Not publishable or packagable, so build executor will exist
          const targets = Object.values(dep.data.targets!);
          const buildTarget = targets.find(
            (t) => t.executor === "nx-simple:build"
          )!;

          // Construct config based on dep's buildable executor and this executor's targetRuntime
          const layerConfig = getConfig(
            {
              ...buildTarget.options,
              targetRuntime: cfg.targetRuntime,
              distribution: "lib" as const,
            },
            {
              ...context,
              projectName: dep.name,
              targetName: "package-lib",
            }
          );

          await buildLayer(layerConfig);
        }

        // 3b. Copy dependency layer to current layer
        for (const fmt of ["cjs", "esm"]) {
          const src = path.join(cfg.layersDir, dep.name);
          const dest = path.join(tmpOutDir, fmt, "node_modules", dep.name);
          await fse.copy(src, dest);
        }
      }
    } catch (err) {
      console.log(err);
      return { success: false };
    }
  }

  // 4. Create package.json
  await createPackageJson({
    projectDir: cfg.projectDir,
    outDir: tmpOutDir,
    entry: cfg.entryRelativeToSrcDir,
    publishedDependencies: deps.published,
  });

  // 5. Move to publish directory
  await fse.move(tmpOutDir, outDir, { overwrite: true });

  // 6. Cleanup
  await fse.remove(cfg.tmpDir);

  return { success: true };
}