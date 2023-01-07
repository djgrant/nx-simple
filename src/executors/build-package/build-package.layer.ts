import path from "node:path";
import util from "node:util";
import fse from "fs-extra";
import globCb from "glob";
import { runSwc } from "utils/swc";
import { generateTsDefinitions, getTsConfig } from "utils/ts";
import { createPackageJson } from "utils/package";
import { getSwcPathMappings } from "utils/swc.paths";
import { getConfig } from "./build-package.config";
import { Options, Context } from "./build-package.types";

const glob = util.promisify(globCb);

/**
 * @description
 *  Compiles layers for project and each of its unpublishable dependencies.
 *  Packages dependent layers into output and emits a package.json for publishing.
 */
export async function runLayerExecutor(
  options: Required<Options>,
  context: Context
) {
  const cfg = getConfig(options, context);
  const tsConfig = getTsConfig(cfg.projectDir);
  const tmpOutDir = `${cfg.tmpLayersDir}/${context.projectName}`;
  const outDir = `${cfg.layersDir}/${context.projectName}`;

  // 1. Create tmp output directory
  await fse.ensureDir(tmpOutDir);

  // 2. Create package.json
  await createPackageJson({
    projectDir: cfg.projectDir,
    outDir: tmpOutDir,
    entryModuleName: cfg.entryModuleName,
  });

  // 3. Typecheck and generate type definitions
  console.log(`Type checking ${context.projectName}...`);

  const typeCheckStart = performance.now();
  const typesValid = generateTsDefinitions(cfg.entry, tmpOutDir, tsConfig);

  if (!typesValid) return { success: false };

  const typeCheckDuration = (performance.now() - typeCheckStart).toFixed(2);

  console.log(`Type check passed in (${typeCheckDuration}ms)`);

  // 4. Calculate path mappings
  const { paths, baseUrl } = await getSwcPathMappings({
    tsConfig,
    srcDir: cfg.projectSrcDir,
  });

  // 5. Compile source files
  console.log(`Compiling ${context.projectName}...`);

  const baseSwcConfig = {
    projectDir: cfg.projectDir,
    srcDir: cfg.projectSrcDir,
    ignoreDir: cfg.projectDistDir,
    target: options.targetRuntime,
    sourceMaps: false,
    paths: paths,
    baseUrl: baseUrl,
  };

  try {
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
  } catch (err) {
    console.error(err);
    return { success: false };
  }

  // 6. Copy assets
  const defaultFilesRe = /^(readme|licence|license)(|\.[a-z]+)$/i;
  const filePaths = await glob(`${cfg.projectDir}/**/*`, {
    nodir: true,
    ignore: `${cfg.projectDir}/dist/**/*`,
  });

  for (const filePath of filePaths) {
    const relativeFilePath = filePath.replace(`${cfg.projectDir}/`, "");
    if (
      relativeFilePath.match(defaultFilesRe) ||
      options.assets.includes(relativeFilePath)
    ) {
      const distFilePath = `${tmpOutDir}/${relativeFilePath}`;
      await fse.ensureDir(path.dirname(distFilePath));
      await fse.copyFile(filePath, distFilePath);
    }
  }

  // 7. Move artefacts to cacheable folder
  await fse.remove(outDir);
  await fse.move(tmpOutDir, outDir);

  // 8. Cleanup
  await fse.remove(tmpOutDir);

  return { success: true };
}
