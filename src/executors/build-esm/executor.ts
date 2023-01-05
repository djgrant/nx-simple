import type { ExecutorContext } from "@nrwl/devkit";
import path from "path";
import fse from "fs-extra";
import globCb from "glob";
import { promisify } from "util";
import { runSwc } from "../../utils/swc";
import { stripTsExtension, generateTsDefinitions } from "../../utils/ts";
import { getProjectDependencies } from "../../utils/nx";
import { execSync } from "child_process";

const glob = promisify(globCb);

type Options = {
  assets?: string[];
  distribution: "internal" | "external";
  entry?: string;
  targetRuntime?: string;
};

type Context = Required<ExecutorContext>;

export default async function runExecutor(options: Options, context: Context) {
  const defaultOptions = {
    assets: [],
    entry: "index.ts",
    targetRuntime: "es2020",
  };

  const mergedOptions = {
    ...defaultOptions,
    ...options,
  };

  switch (options.distribution) {
    case "external":
      return runExternalExecutor(mergedOptions, context);
    case "internal":
      return runInternalExecutor(mergedOptions, context);
  }
}

function getProject(context: any) {
  return context.workspace.projects[context.projectName];
}

function getPaths(options: Options, context: Context) {
  const project = getProject(context);
  const projectDir = path.join(context.root, project.root);
  const entry = `${projectDir}/${options.entry}`;
  const srcDir = path.dirname(entry);
  const distDir = path.join(projectDir, "dist");
  const publishDir = path.join(context.root, "dist", context.projectName);
  const tmpPublishDir = path.join(context.root, "tmp", context.projectName);
  const entryModuleName = stripTsExtension(path.relative(srcDir, entry));
  return {
    projectDir,
    entry,
    srcDir,
    distDir,
    publishDir,
    tmpPublishDir,
    entryModuleName,
  };
}

async function runInternalExecutor(
  options: Required<Options>,
  context: Context
) {
  const project = getProject(context);
  const paths = getPaths(options, context);

  const { projectDir, srcDir, distDir, entryModuleName } = paths;

  // 1. Check package.json is configured correctly
  const packageJson = await fse.readJSON(`${projectDir}/package.json`);
  const expectedMainField = `dist/${entryModuleName}.js`;
  const validTypeFields: (string | undefined)[] = [
    options.entry,
    stripTsExtension(options.entry),
  ];

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
      target: options.targetRuntime,
      sourceMaps: true,
    });
  } catch (err) {
    console.error(err);
    return { success: false };
  }

  return { success: true };
}

async function runExternalExecutor(
  options: Required<Options>,
  context: Context
) {
  const project = getProject(context);
  const {
    projectDir,
    entry,
    srcDir,
    distDir,
    publishDir,
    tmpPublishDir,
    entryModuleName,
  } = getPaths(options, context);

  // 0. Setup tmp publish directory
  await fse.rm(tmpPublishDir, { recursive: true, force: true });
  await fse.ensureDir(tmpPublishDir);

  // 1. Get project dependencies
  const deps = await getProjectDependencies(
    context.projectGraph,
    context.projectName,
    context.root
  );

  // 2. Create package.json
  const packageJson = await fse.readJSON(`${projectDir}/package.json`);

  packageJson.main = `cjs/${entryModuleName}.cjs`;
  packageJson.module = `esm/${entryModuleName}.js`;
  packageJson.types = `types/${entryModuleName}.d.ts`;

  packageJson.dependencies = deps.published
    .filter((dep) => {
      if (!packageJson.peerDependencies) return true;
      if (!dep.packageName) return false;
      return !packageJson.peerDependencies.includes(dep.packageName);
    })
    .reduce(
      (acc, dep) => ({ ...acc, [dep.packageName!]: dep.data.version }),
      {}
    );

  await fse.writeJSON(`${tmpPublishDir}/package.json`, packageJson, {
    spaces: 2,
  });

  // 3. TODO: Compile non-publishable projects

  // 4. Typecheck and generate type definitions
  console.log(`Type checking ${project.name}...`);

  const typeCheckMark = performance.now();
  const typesValid = generateTsDefinitions(entry, projectDir, tmpPublishDir);

  if (!typesValid) return { success: false };
  const typeCheckDuration = (performance.now() - typeCheckMark).toFixed(2);

  console.log(`Type check passed (${typeCheckDuration}ms)`);

  // 4. Compile
  console.log(`Compiling ${project.name}...`);

  const baseSwcConfig = {
    projectDir,
    srcDir,
    ignoreDir: distDir,
    target: options.targetRuntime,
    sourceMaps: false,
  };

  // TODO: re-map import identifiers to unpulished deps

  try {
    runSwc({
      ...baseSwcConfig,
      outDir: `${tmpPublishDir}/esm`,
      moduleType: "es6",
    });
    runSwc({
      ...baseSwcConfig,
      outDir: `${tmpPublishDir}/cjs`,
      moduleType: "commonjs",
    });
  } catch (err) {
    console.error(err);
    return { success: false };
  }

  // 5. Write package.json

  // 6. Copy assets
  const defaultFilesRe = /^(readme|licence|license)(|\.[a-z]+)$/i;
  const filePaths = await glob(`${projectDir}/**/*`, { nodir: true });

  for (const filePath of filePaths) {
    const relativeFilePath = filePath.replace(`${projectDir}/`, "");
    if (
      relativeFilePath.match(defaultFilesRe) ||
      options.assets.includes(relativeFilePath)
    ) {
      const distFilePath = `${tmpPublishDir}/${relativeFilePath}`;
      await fse.ensureDir(path.dirname(distFilePath));
      await fse.copyFile(filePath, distFilePath);
    }
  }

  // 7. Move to publish directory
  await fse.remove(publishDir);
  await fse.move(tmpPublishDir, publishDir);

  return { success: true };
}
