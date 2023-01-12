import path from "node:path";
import fse from "fs-extra";
import { Config } from "utils/config";
import { createPackageJson } from "utils/package-json";
import { runSwc } from "utils/swc";
import { generateTsDefinitions } from "utils/ts";
import { getSwcPathMappings } from "utils/swc.paths";
import { copyAssets } from "../../utils/assets";

export async function buildLayer(cfg: Config) {
  const tmpOutDir = path.join(cfg.tmpLayersDir, cfg.projectName);
  const outDir = path.join(cfg.layersDir, cfg.projectName);

  // 1. Create tmp output directory
  await fse.ensureDir(tmpOutDir);

  // 2. Create package.json
  await createPackageJson({
    projectDir: cfg.projectDir,
    outDir: tmpOutDir,
    entry: cfg.entryRelativeToSrcDir,
  });

  // 3. Typecheck and generate type definitions
  console.log(`Type checking ${cfg.projectName}...`);

  const typeCheckStart = performance.now();

  const typesValid = generateTsDefinitions(
    cfg.entryPath,
    tmpOutDir,
    cfg.tsConfig
  );

  if (!typesValid) {
    throw new Error(
      `Could not build layer ${cfg.projectName} because type check failed`
    );
  }

  const typeCheckDuration = (performance.now() - typeCheckStart).toFixed(2);

  console.log(`Type check passed in (${typeCheckDuration}ms)`);

  // 4. Calculate path mappings
  const { paths, baseUrl } = await getSwcPathMappings({
    tsConfig: cfg.tsConfig,
    srcDir: cfg.projectBaseDir,
  });

  // 5. Compile source files
  console.log(`Compiling ${cfg.projectName}...`);

  const baseSwcConfig = {
    projectDir: cfg.projectDir,
    srcDir: cfg.projectBaseDir,
    ignoreDir: cfg.projectDistDir,
    target: cfg.targetRuntime,
    sourceMaps: false,
    paths: paths,
    baseUrl: baseUrl,
  };

  await Promise.all([
    runSwc({
      ...baseSwcConfig,
      outDir: path.join(tmpOutDir, "esm"),
      moduleType: "es6",
      ignoreDir: cfg.projectDistDir,
    }),
    runSwc({
      ...baseSwcConfig,
      outDir: path.join(tmpOutDir, "cjs"),
      moduleType: "commonjs",
      ignoreDir: cfg.projectDistDir,
    }),
  ]);

  // 6. Create package.json files to specify module type
  await fse.writeJson(
    path.join(tmpOutDir, "cjs", "package.json"),
    { type: "commonjs" },
    { spaces: 2 }
  );

  await fse.writeJson(
    path.join(tmpOutDir, "esm", "package.json"),
    { type: "module" },
    { spaces: 2 }
  );

  // 6. Copy assets
  await copyAssets(cfg, {
    outDir: tmpOutDir,
    baseDirOutDirs: ["esm", "cjs"].map((f) => path.join(tmpOutDir, f)),
  });

  // 7. Move artefacts to cacheable folder
  await fse.move(tmpOutDir, outDir, { overwrite: true });

  // 8. Cleanup
  await fse.remove(tmpOutDir);
}
