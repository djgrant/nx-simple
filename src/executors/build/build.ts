import fse from "fs-extra";
import { getConfig } from "utils/config";
import { validateConfig, validateProjectPackageJson } from "utils/contracts";
import { runSwc } from "utils/swc";
import { getSwcPathMappings } from "utils/swc.paths";
import { Options, Context } from "./build.types";

export default async function buildExecutor(
  options: Options,
  context: Context
) {
  const cfg = getConfig(options, context);

  if (context.isVerbose) {
    console.log("nx-simple config:");
    console.log(cfg);
  }

  // 1. Validate project is setup correctly
  validateConfig(cfg);
  await validateProjectPackageJson(cfg);

  // 2. Clean slate
  await fse.remove(cfg.projectDistDir);
  await fse.ensureDir(cfg.projectDistDir);

  // 3. Calculate path mappings
  const { paths, baseUrl } = await getSwcPathMappings({
    tsConfig: cfg.tsConfig,
    srcDir: cfg.projectBaseDir,
  });

  // 4. Compile to ESM
  try {
    await runSwc({
      projectDir: cfg.projectDir,
      srcDir: cfg.projectBaseDir,
      outDir: cfg.projectDistDir,
      ignoreDir: cfg.projectDistDir,
      target: cfg.targetRuntime,
      moduleType: "es6",
      sourceMaps: true,
      baseUrl,
      paths,
    });
  } catch (err) {
    console.error(err);
    return { success: false };
  }

  return { success: true };
}
