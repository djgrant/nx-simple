// @ts-check
const path = require("path");
const fse = require("fs-extra");
const ts = require("typescript");
const devkit = require("@nrwl/devkit");
const glob = require("util").promisify(require("glob"));
const {
  getProject,
  getTsMessages,
  getTsConfig,
  runSwc,
  stripTsExtension,
} = require("../../utils");

/**
 * @typedef {import('./schema').BuildExecutorSchema} BuildExecutorSchema
 */

const defaultOptions = {
  assets: [],
  entry: "index.ts",
  target: "es2020",
};

/**
 * @param {BuildExecutorSchema} options
 * @param {any} context
 */
function getPaths(options, context) {
  const project = getProject(context);
  const projectDir = path.join(context.root, project.root);
  const entry = `${projectDir}/${options.entry}`;
  const srcDir = path.dirname(entry);
  const distDir = path.join(projectDir, "dist");
  const publishDir = path.join(context.root, "dist", context.projectName);
  const entryModuleName = stripTsExtension(path.relative(srcDir, entry));
  return { projectDir, entry, srcDir, distDir, publishDir, entryModuleName };
}

/**
 * @param {BuildExecutorSchema} options
 * @param {any} context
 */
module.exports = async function runExecutor(options, context) {
  const mergedOptions = { ...defaultOptions, ...options };

  if (options.distribution === "external") {
    return runExternalExecutor(mergedOptions, context);
  }

  if (options.distribution === "internal") {
    return runInternalExecutor(mergedOptions, context);
  }
};

/**
 * @param {Required<BuildExecutorSchema>} options
 * @param {any} context
 */
async function runInternalExecutor(options, context) {
  const project = getProject(context);
  const paths = getPaths(options, context);

  const { projectDir, srcDir, distDir, entryModuleName } = paths;

  // 1. Check package.json is configured correctly
  const packageJson = await fse.readJSON(`${projectDir}/package.json`);
  const expectedMainField = `dist/${entryModuleName}.js`;
  const validTypeFields = [options.entry, stripTsExtension(options.entry)];

  if (entryModuleName === "index") validTypeFields.push(undefined);

  if (!packageJson.main || !packageJson.main.startsWith(expectedMainField)) {
    console.error(
      `[ERROR] ${project.name} package.json "main" field should point to ${expectedMainField}.js".`
    );
    return { success: false };
  }

  if (!validTypeFields.includes(packageJson.types)) {
    console.error(
      `[WARNING] ${project.name} package.json "types" field does not point to the entry module. Set it to ${options.entry} to get intellisense support in your IDE.`
    );
  }

  // 2. Clean slate
  await fse.rm(distDir, { recursive: true, force: true });
  await fse.ensureDir(distDir);

  // 3. Compile to ESM
  try {
    runSwc({
      projectDir,
      srcDir,
      outDir: distDir,
      ignoreDir: distDir,
      moduleType: "es6",
      target: options.target,
      sourceMaps: true,
    });
  } catch (err) {
    console.error(err);
    return { success: false };
  }

  return { success: true };
}

/**
 * @param {Required<BuildExecutorSchema>} options
 * @param {any} context
 */
async function runExternalExecutor(options, context) {
  const { projectDir, entry, srcDir, distDir, publishDir, entryModuleName } =
    getPaths(options, context);

  // 1. Clean slate
  await fse.rm(publishDir, { recursive: true, force: true });
  await fse.ensureDir(publishDir);

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
    rootNames: [entry],
    options: {
      ...(tsConfig?.options || {}),
      declaration: true,
      emitDeclarationOnly: true,
      declarationDir: `${publishDir}/types`,
    },
  });

  let emitResult = program.emit();

  let diagnostics = ts
    .getPreEmitDiagnostics(program)
    .concat(emitResult.diagnostics);

  const messages = getTsMessages(diagnostics);

  if (messages.length) {
    console.error(messages.join("\n"));
    return { success: false };
  }

  // 4. Compile
  const baseSwcConfig = {
    projectDir,
    srcDir,
    ignoreDir: distDir,
    target: options.target,
    sourceMaps: false,
  };

  try {
    runSwc({
      ...baseSwcConfig,
      outDir: `${publishDir}/esm`,
      moduleType: "es6",
    });
    runSwc({
      ...baseSwcConfig,
      outDir: `${publishDir}/cjs`,
      moduleType: "commonjs",
    });
  } catch (err) {
    console.error(err);
    return { success: false };
  }

  // 5. Write package.json
  packageJson.main = `cjs/${entryModuleName}.cjs`;
  packageJson.module = `esm/${entryModuleName}.js`;
  packageJson.types = `types/${entryModuleName}.d.ts`;

  await fse.writeJSON(`${publishDir}/package.json`, packageJson, { spaces: 2 });

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
