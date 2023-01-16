import path from "node:path";
import util from "node:util";
import fse from "fs-extra";
import globCb from "glob";
import { Config } from "./config";

const glob = util.promisify(globCb);

export async function copyAssets(
  cfg: Config,
  opts: { outDir: string; outBaseDirs: string[] }
) {
  const defaultFilesRe = /^(readme|licence|license)(|\.[a-z]+)$/i;
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
