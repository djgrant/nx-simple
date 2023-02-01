import path from "node:path";
import fse from "fs-extra";
import { Config } from "utils/config";
import { createPackageJson } from "utils/package-json";
import { runSwc } from "utils/swc";
import { generateTsDefinitions } from "utils/ts";
import { getSwcPathMappings } from "utils/swc.paths";
import { copyAssets } from "../../utils/assets";
import { PackageOptions } from "./package.types";

export async function buildLayer(cfg: Config<PackageOptions>) {
  const tmpDir = path.join(cfg.tmpLayersDir, cfg.projectName);
  const tmpDistDir = path.join(tmpDir, "dist");
  const tmpDistCjsDir = path.join(tmpDir, "dist-cjs");
  const outDir = path.join(cfg.layersDir, cfg.projectName);
  const typesDir = path.join(tmpDir, "types");

  // 0. Set up
  await fse.ensureDir(tmpDir);
  await fse.ensureDir(outDir);
  await fse.ensureDir(typesDir);

  // 1. Create package.json
  const generatedPackageJson = await createPackageJson({
    sourcePackageJson: cfg.packageJson,
  });

  await fse.writeJSON(path.join(tmpDir, "package.json"), generatedPackageJson, {
    spaces: 2,
  });

  // 2. Typecheck and generate type definitions
  console.log(`Type checking ${cfg.projectName}...`);
  const typeCheckStart = performance.now();

  const typesValid = await generateTsDefinitions(
    cfg.tsConfig,
    typesDir,
    cfg.projectDir
  );

  if (!typesValid) throw new Error("Type check failed");

  await fse.copy(typesDir, tmpDistDir);
  await fse.copy(typesDir, tmpDistCjsDir);
  await fse.rm(typesDir, { recursive: true });

  const tscDuration = (performance.now() - typeCheckStart).toFixed(2);
  console.log(`Types checked and .d.ts files generated in (${tscDuration}ms)`);

  // 3. Calculate path mappings
  const { paths, baseUrl } = await getSwcPathMappings({
    tsConfig: cfg.tsConfig,
  });

  // 4. Compile source files
  console.log(`Compiling ${cfg.projectName}...`);

  const baseSwcConfig = {
    projectDir: cfg.projectDir,
    srcDir: cfg.projectSrcDir,
    ignoreDir: cfg.projectDistDir,
    target: cfg.targetRuntime,
    sourceMaps: false,
    paths: paths,
    baseUrl: baseUrl,
  };

  await Promise.all([
    runSwc({
      ...baseSwcConfig,
      outDir: tmpDistDir,
      moduleType: "es6",
      ignoreDir: cfg.projectDistDir,
    }),
    runSwc({
      ...baseSwcConfig,
      outDir: tmpDistCjsDir,
      moduleType: "commonjs",
      ignoreDir: cfg.projectDistDir,
    }),
  ]);

  // 5. Create package.json files to specify module type
  await fse.writeJson(
    path.join(tmpDistDir, "package.json"),
    { type: "module" },
    { spaces: 2 }
  );

  await fse.writeJson(
    path.join(tmpDistCjsDir, "package.json"),
    { type: "commonjs" },
    { spaces: 2 }
  );

  // 6. Copy assets
  await copyAssets(cfg, {
    outDir: tmpDir,
    outBaseDirs: [tmpDistDir, tmpDistCjsDir],
  });

  // 7. Copy artefacts to cacheable folder
  await fse.rm(outDir, { recursive: true });
  await fse.copy(tmpDir, outDir);
}
