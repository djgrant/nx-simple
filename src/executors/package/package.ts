import path from "node:path";
import fse from "fs-extra";
import { getConfig } from "utils/config";
import { createPackageJson } from "utils/package-json";
import { getProjectDependencies } from "utils/nx.deps";
import { PackageOptions, Context } from "./package.types";
import { buildLayer } from "./package.layer";
import {
  validateConfig,
  validateProjectPackageJson,
} from "../../utils/contracts";

export default async function packageExecutor(
  options: PackageOptions,
  context: Context
) {
  switch (options.distribution) {
    case "app":
    case "npm":
      return appOrNpmPackageExecutor(options, context);

    case "lib":
      return libPackageExecutor(options, context);
  }
}

export async function libPackageExecutor(
  options: PackageOptions,
  context: Context
) {
  // 0. Set up
  const cfg = await getConfig(options, context);
  process.on("exit", () => fse.removeSync(cfg.tmpDir));

  // 0. Set up cleanup
  process.on("exit", () => fse.removeSync(cfg.tmpDir));

  // 1. Validate project is setup correctly
  validateConfig(cfg);
  await validateProjectPackageJson(cfg.packageJson, { requireExports: true });

  // 3. Compile current layer
  console.log(`Building layer for ${context.projectName}...`);
  await buildLayer(cfg);

  return { success: true };
}

export async function appOrNpmPackageExecutor(
  options: PackageOptions,
  context: Context
) {
  // 0. Set up
  const cfg = await getConfig(options, context);
  const outDir = path.join(cfg.workspaceDistDir, context.projectName);
  const layerDir = path.join(cfg.layersDir, context.projectName);
  const tmpOutDir = path.join(cfg.tmpDir, context.projectName);

  await fse.ensureDir(outDir);
  await fse.ensureDir(tmpOutDir);

  process.on("exit", () => fse.removeSync(cfg.tmpDir));

  // 1. Validate project is setup correctly
  validateConfig(cfg);

  await validateProjectPackageJson(cfg, {
    requireExports: options.distribution === "npm",
  });

  // 2. Get project dependencies
  const deps = await getProjectDependencies(
    context.projectGraph,
    context.projectName,
    context.root
  );

  // 3. Compile current layer
  console.log(`Building layer for ${context.projectName}...`);

  await buildLayer(cfg);
  await fse.copy(layerDir, tmpOutDir);

  // 4. Copy non-publishable builds to publishable distribution
  if (deps.unpublished.length) {
    try {
      for (const dep of deps.unpublished) {
        // 4a. Build sub package programatically if project does not have a package executor
        if (!dep.packagable) {
          // Construct config based on dep's buildable executor and this executor's targetRuntime
          const layerConfig = await getConfig(
            {
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

        // 4b. Copy dependency layer to current layer
        for (const distDir of ["dist", "dist-cjs"]) {
          const src = path.join(cfg.layersDir, dep.name);
          const outDir = path.join(
            tmpOutDir,
            distDir,
            "node_modules",
            dep.name
          );
          const outDirUnusedDist = path.join(
            outDir,
            distDir === "dist" ? "dist-cjs" : "dist"
          );
          await fse.copy(src, outDir);
          await fse.rm(outDirUnusedDist, { recursive: true });
        }
      }
    } catch (err) {
      console.log(err);
      return { success: false };
    }
  }

  // 5. Create package.json
  const generatedPackageJson = await createPackageJson({
    sourcePackageJson: cfg.packageJson,
    publishedDependencies: deps.published,
  });

  await fse.writeJSON(
    path.join(tmpOutDir, "package.json"),
    generatedPackageJson,
    { spaces: 2 }
  );

  // 6. Move to publish directory
  await fse.rm(outDir, { recursive: true });
  await fse.copy(tmpOutDir, outDir);

  return { success: true };
}
