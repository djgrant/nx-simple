import path from "node:path";
import fse from "fs-extra";
import glob from "glob";
import { Config } from "./config";

export async function copyAssets(
  cfg: Config,
  opts: { outDir: string; outBaseDirs: string[] }
) {
  const defaultFilesRe = /^(readme|licence|license|dockerfile)(|\.[a-z]+)$/i;
  const filePaths = await glob(`${cfg.projectDir}/**/*`, {
    nodir: true,
    ignore: [`${cfg.projectDir}/dist/**/*`],
  });

  for (const filePath of filePaths) {
    const filePathRelativeToProject = path.relative(cfg.projectDir, filePath);
    if (filePathRelativeToProject.match(defaultFilesRe)) {
      const outFilePath = path.join(opts.outDir, filePathRelativeToProject);
      await fse.copy(filePath, outFilePath);
    }
  }
}
