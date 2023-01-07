import fse from "fs-extra";
import { validateInternalPackageJson } from "utils/contracts";
import { runSwc } from "utils/swc";
import { Options, Context } from "./build-package.types";
import { getConfig } from "./build-package.config";

export async function runInternalExecutor(
  options: Required<Options>,
  context: Context
) {
  const cfg = getConfig(options, context);

  // 1. Check package.json is configured correctly
  const packageIsValid = await validateInternalPackageJson({
    entry: cfg.entry,
    entryModuleName: cfg.entryModuleName,
    projectDir: cfg.projectDir,
    projectName: context.projectName,
  });

  if (!packageIsValid) return { success: false };

  // 2. Clean slate
  await fse.remove(cfg.projectDistDir);
  await fse.ensureDir(cfg.projectDistDir);

  // 3. Compile to ESM
  try {
    await runSwc({
      projectDir: cfg.projectDir,
      srcDir: cfg.projectSrcDir,
      outDir: cfg.projectDistDir,
      ignoreDir: cfg.projectDistDir,
      target: options.targetRuntime,
      moduleType: "es6",
      sourceMaps: true,
    });
  } catch (err) {
    console.error(err);
    return { success: false };
  }

  return { success: true };
}
