import path, { relative } from "node:path";
import util from "node:util";
import fse from "fs-extra";
import globCb from "glob";
import { runSwc } from "utils/swc";
import { getProjectDependencies } from "utils/nx.deps";
import { generateTsDefinitions, getTsConfig } from "utils/ts";
import { createPackageJson } from "utils/package";
import { Options, Context } from "./build-package.types";
import { getConfig } from "./build-package.config";

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
  const tmpLayersSrcDir = path.resolve(cfg.projectSrcDir, "../", "layers");
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
  const tsConfig = getTsConfig(cfg.projectDir);
  const typesValid = generateTsDefinitions(cfg.entry, tmpOutDir, tsConfig);

  if (!typesValid) return { success: false };

  const typeCheckDuration = (performance.now() - typeCheckStart).toFixed(2);

  console.log(`Type check passed (${typeCheckDuration}ms)`);

  // 4. Calculate path mappings
  /**
    1. Do we need to map paths from computed TypeScript config? Check `tsconfig.pathsBasePath` is source directory or within it.
    2. Should we add inferred baseUrl mappings? Check `tsconfig.baseUrl` is source directory or within it.
    3. Set `swcBaseUrl` to baseUrl or pathsBasePath, whichever is valid and higher in the hierarchy.
    4. If should map paths, remap `tsconfig.paths` relative to `swcBaseUrl`
    5. If should infer baseUrl paths, read directories that are children of baseUrl. Remap their paths relative to `swcBaseUrl`.
    6. Set `layersRelativeSwcBaseUrl` (self-explanatory).
    7. Map unpublished dependencies paths to `layersRelativeSwcBaseUrl`
    8. Merge paths and set as `swcPaths`.
   */

  if (!tsConfig) throw new Error("this will just be a warning");

  // todo extraact this
  const tsBasePath = tsConfig.options.baseUrl!;
  const tsPathsBasePath = tsConfig.options.pathsBasePath as string;

  const isPath = (_path: string) => ({
    parentOf: (child: string) => {
      return _path.split(path.sep) < child.split(path.sep);
    },
  });

  const hasValidBaseUrl = !isPath(tsBasePath).parentOf(cfg.projectSrcDir);
  const hasValidPaths = !isPath(tsPathsBasePath).parentOf(tsBasePath);

  if (!hasValidBaseUrl) return { baseUrl: null, paths: null };

  const swcBaseUrl = path.relative(cfg.projectSrcDir, tsBasePath) || ".";
  const srcRelativeToBaseUrl = path.relative(tsBasePath, cfg.projectSrcDir);

  const swcPaths: Record<string, string[]> = {};

  if (tsConfig.options.paths && hasValidPaths) {
    for (const [pathKey, locations] of Object.entries(tsConfig.options.paths)) {
      if (locations.some((l) => l.startsWith(".."))) {
        throw new Error(
          `Path mapping "${pathKey}" contains locations outside source directory.`
        );
      }
      swcPaths[pathKey] = locations.map((l) => path.join(swcBaseUrl, l));
    }
  }

  if (hasValidBaseUrl) {
    const baseChildDirents = await fse
      .readdir(tsBasePath, { withFileTypes: true })
      .catch(() => {
        throw new Error(`baseUrl ${tsBasePath} does not exist`);
      });

    for (const child of baseChildDirents) {
      if (child.isDirectory()) {
        swcPaths[`${child.name}/*`] = [`${child.name}/*`];
      } else {
        swcPaths[`${child.name}`] = [`${child.name}`];
      }
    }
  }

  const deps = await getProjectDependencies(
    context.projectGraph,
    context.projectName,
    context.root
  );

  for (const layer of deps.unpublished) {
    if (!layer.packageName) continue;
    const location = path.join(
      srcRelativeToBaseUrl,
      "layers",
      layer.packageName
    );
    swcPaths[layer.packageName] = [`../${location}`];
    swcPaths[`${layer.packageName}/*`] = [`../${location}/*`];

    // swc will not rewrite paths unless the directory exists
    // todo: get swc to remove this annoying feature
    // todo: could symlink (to reduce copy time) to a tmp directory and put a layer dir adjacent
    await fse.ensureDir(path.join(tmpLayersSrcDir, layer.packageName));
    console.log(path.join(tmpLayersSrcDir, layer.packageName));
  }

  // 4. Compile source files
  console.log(`Compiling ${context.projectName}...`);

  const baseSwcConfig = {
    projectDir: cfg.projectDir,
    srcDir: cfg.projectSrcDir,
    ignoreDir: cfg.projectDistDir,
    target: options.targetRuntime,
    sourceMaps: false,
    paths: swcPaths,
    baseUrl: tsBasePath,
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

  await fse.remove(tmpLayersSrcDir);

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
