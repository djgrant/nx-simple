import fse from "fs-extra";
import { getConfig } from "utils/config";
import { validateConfig, validateProjectPackageJson } from "utils/contracts";
import { runSwc } from "utils/swc";
import { getSwcPathMappings } from "utils/swc.paths";
import { copyAssets } from "../../utils/assets";
import { BuildOptions, Context } from "./build.types";

export default async function buildExecutor(
  options: BuildOptions,
  context: Context
) {
  // 0. Set up
  const cfg = await getConfig(options, context);

  // 1. Validate project is configured correctly
  validateConfig(cfg);
  await validateProjectPackageJson(cfg.packageJson, { requireExports: false });

  // 2. Clean slate
  await fse.remove(cfg.projectDistDir);
  await fse.ensureDir(cfg.projectDistDir);

  // 3. Calculate path mappings
  const { paths, baseUrl } = await getSwcPathMappings({
    srcDir: cfg.projectBaseDir,
    tsConfig: cfg.tsConfig,
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

  // 5. Copy assets
  await copyAssets(cfg, {
    outDir: cfg.projectDistDir,
    outBaseDirs: [cfg.projectDistDir],
  });

  return { success: true };
}
