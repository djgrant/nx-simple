import path from "node:path";
import util from "node:util";
import fse from "fs-extra";
import globCb from "glob";
import { Config } from "utils/config";
import { createPackageJson } from "utils/package-json";
import { runSwc } from "utils/swc";
import { generateTsDefinitions, getTsConfig } from "utils/ts";
import { getSwcPathMappings } from "utils/swc.paths";
import { Options, Context } from "./package.types";

const glob = util.promisify(globCb);

export async function buildLayer(cfg: Config) {
  const tsConfig = getTsConfig(cfg.projectDir);

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
  const typesValid = generateTsDefinitions(cfg.entryPath, tmpOutDir, tsConfig);

  if (!typesValid) {
    throw new Error("");
  }

  const typeCheckDuration = (performance.now() - typeCheckStart).toFixed(2);

  console.log(`Type check passed in (${typeCheckDuration}ms)`);

  // 4. Calculate path mappings
  const { paths, baseUrl } = await getSwcPathMappings({
    tsConfig: tsConfig,
    srcDir: cfg.projectSrcDir,
  });

  // 5. Compile source files
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
      outDir: `${tmpOutDir}/esm`,
      moduleType: "es6",
      ignoreDir: cfg.projectDistDir,
    }),
    runSwc({
      ...baseSwcConfig,
      outDir: `${tmpOutDir}/cjs`,
      moduleType: "commonjs",
      ignoreDir: cfg.projectDistDir,
    }),
  ]);

  // 6. Copy assets
  const defaultFilesRe = /^(readme|licence|license)(|\.[a-z]+)$/i;
  const filePaths = await glob(`${cfg.projectDir}/**/*`, {
    nodir: true,
    ignore: `${cfg.projectDir}/dist/**/*`,
  });

  for (const filePath of filePaths) {
    const relativeFilePath = path.relative(cfg.projectDir, "");
    if (
      relativeFilePath.match(defaultFilesRe) ||
      cfg.assets.includes(relativeFilePath)
    ) {
      const distFilePath = path.join(tmpOutDir, relativeFilePath);
      await fse.ensureDir(path.dirname(distFilePath));
      await fse.copyFile(filePath, distFilePath);
    }
  }

  // 7. Move artefacts to cacheable folder
  await fse.move(tmpOutDir, outDir, { overwrite: true });

  // 8. Cleanup
  await fse.remove(tmpOutDir);
}
