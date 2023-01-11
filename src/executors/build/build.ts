import fse from "fs-extra";
import { getConfig } from "utils/config";
import { validateProjectPackageJson } from "utils/contracts";
import { runSwc } from "utils/swc";
import { getSwcPathMappings } from "utils/swc.paths";
import { getTsConfig } from "../../utils/ts";
import { Options, Context } from "./build.types";

export default async function buildExecutor(
  options: Options,
  context: Context
) {
  const cfg = getConfig(options, context);
  const tsConfig = getTsConfig(cfg.projectDir);

  // 1. Check package.json is configured correctly
  const packageIsValid = await validateProjectPackageJson(cfg);

  if (!packageIsValid) return { success: false };

  // 2. Clean slate
  await fse.remove(cfg.projectDistDir);
  await fse.ensureDir(cfg.projectDistDir);

  // 3. Calculate path mappings
  const { paths, baseUrl } = await getSwcPathMappings({
    tsConfig: tsConfig,
    srcDir: cfg.projectSrcDir,
  });

  // 4. Compile to ESM
  try {
    await runSwc({
      projectDir: cfg.projectDir,
      srcDir: cfg.projectSrcDir,
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
