// @ts-check
const path = require("path");
const fse = require("fs-extra");
const devkit = require("@nrwl/devkit");
const esbuild = require("esbuild");
const ts = require("typescript");
const glob = require("util").promisify(require("glob"));
const { getTsDiagnosticsMessages, getTsConfig } = require("../../utils");

/**
 * @typedef {import('./schema').BuildExecutorSchema} BuildExecutorSchema
 * @typedef {import('esbuild').BuildOptions} EsbuildOptions
 */

/**  @type Required<Omit<BuildExecutorSchema, 'strategy'>> **/
const defaultOptions = {
  assets: [],
  entry: "index.ts",
  esbuild: {},
};

/**
 * @param {BuildExecutorSchema} options
 * @param {any} context
 */
module.exports = async function runExecutor(options, context) {
  const mergedOptions = {
    ...defaultOptions,
    ...options,
    esbuild: { ...defaultOptions.esbuild, ...options.esbuild },
  };
  if (options.strategy === "external") {
    return runExternalExecutor(mergedOptions, context);
  }
  if (options.strategy === "internal") {
    return runInternalExecutor(mergedOptions, context);
  }
};

/**
 * @param {Required<BuildExecutorSchema>} options
 * @param {any} context
 */
async function runExternalExecutor(options, context) {
  const project = context.workspace.projects[context.projectName];
  const projectDir = path.join(context.root, project.root);
  const distDir = path.join(context.root, "dist", context.projectName);
  const entryPath = `${projectDir}/${options.entry}`;

  // 1. Clean slate
  await fse.rm(distDir, { recursive: true });

  // 2. Read package.json
  const packageJson = devkit.createPackageJson(
    context.projectName,
    context.projectGraph,
    {
      root: context.root,
      isProduction: true,
    }
  );

  // 3. Typecheck and generate type definitions
  const tsConfig = getTsConfig(projectDir);

  const program = ts.createProgram({
    rootNames: [entryPath],
    options: {
      ...tsConfig.options,
      declaration: true,
      emitDeclarationOnly: true,
      declarationDir: distDir,
    },
  });

  let emitResult = program.emit();

  let diagnostics = ts
    .getPreEmitDiagnostics(program)
    .concat(emitResult.diagnostics);

  const messages = getTsDiagnosticsMessages(diagnostics);

  if (messages.length) {
    throw new Error("TypeScript Compiler Error\n" + messages.join("\n"));
  }

  // 4. Compile
  /**
   * @param {'esm' | 'cjs'} format
   * @return {EsbuildOptions}
   * */
  const requiredEsbuildOptions = (format) => ({
    entryPoints: [entryPath],
    format,
    outfile: `${distDir}/index.${format}`,
  });

  // @todo if Object.keys(options.esbuild) intersects Object.keys(requiredEsbuildOptions)
  //       throw an error/warning

  await esbuild.build({
    ...options.esbuild,
    ...requiredEsbuildOptions("esm"),
  });

  await esbuild.build({
    ...options.esbuild,
    ...requiredEsbuildOptions("cjs"),
  });

  // 5. Write package.json
  packageJson.main = "index.cjs";
  packageJson.module = "index.js";
  packageJson.types = options.entry.replace(/.ts$/, ".d.ts");

  await fse.writeJSON(`${distDir}/package.json`, packageJson, { spaces: 2 });

  // 6. Copy assets
  const defaultFilesRe = /^(readme|licence|license)(|\.[a-z]+)$/i;
  const filePaths = await glob(`${projectDir}/**/*`, { nodir: true });

  for (const filePath of filePaths) {
    const relativeFilePath = filePath.replace(`${projectDir}/`, "");
    if (
      relativeFilePath.match(defaultFilesRe) ||
      options.assets.includes(relativeFilePath)
    ) {
      const distFilePath = `${distDir}/${relativeFilePath}`;
      await fse.ensureDir(path.dirname(distFilePath));
      await fse.copyFile(filePath, distFilePath);
    }
  }

  return { success: true };
}

/**
 * @param {Required<BuildExecutorSchema>} options
 * @param {any} context
 */
async function runInternalExecutor(options, context) {
  const project = context.workspace.projects[context.projectName];
  const projectDir = path.join(context.root, project.root);
  const distDir = path.join(projectDir, "dist");
  const entryPath = `${projectDir}/${options.entry}`;

  // 1. Check package.json is configured correctly
  const packageJson = await fse.readJSON(`${projectDir}/package.json`);
  const validMainFields = ["dist", "dist/index", "dist/index.js"];
  const validTypeFields = [options.entry, options.entry.replace(/\.tsx?$/, "")];

  if (!validMainFields.includes(packageJson.main)) {
    console.error(
      `[ERROR] ${project.name} package.json "main" field is incorrect. For internal builds to work, set it to "dist/index.js".`
    );
    return { success: false };
  }

  if (![validTypeFields].includes(packageJson.types)) {
    console.error(
      `[WARNING] ${project.name} package.json "types" field does not point to the entry module. Set it to ${options.entry} to get intellisense support in your IDE.`
    );
  }

  // 2. Clean slate
  await fse.rm(distDir, { recursive: true });

  // 3. Compile to ESM
  console.log({
    ...options.esbuild,
    format: "esm",
    outfile: `${distDir}/index.js`,
    entryPoints: [entryPath],
  });
  try {
    await esbuild.build({
      ...options.esbuild,
      format: "esm",
      outfile: `${distDir}/index.js`,
      entryPoints: [entryPath],
    });
  } catch (err) {
    console.error(err);
    return { success: false };
  }

  return { success: true };
}
