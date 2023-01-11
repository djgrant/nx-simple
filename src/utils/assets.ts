import path from "node:path";
import util from "node:util";
import fse from "fs-extra";
import globCb from "glob";
import { Config } from "./config";
import { isPath } from "./path";

const glob = util.promisify(globCb);

export async function copyAssets(
  cfg: Config,
  opts: {
    outDir: string;
    baseDirOutDirs?: string[];
  }
) {
  const baseDirOutDirs = opts.baseDirOutDirs || [opts.outDir];
  const defaultFilesRe = /^(readme|licence|license)(|\.[a-z]+)$/i;
  const filePaths = await glob(`${cfg.projectDir}/**/*`, {
    nodir: true,
    ignore: `${cfg.projectDir}/dist/**/*`,
  });

  for (const filePath of filePaths) {
    const relativeFilePath = path.relative(cfg.projectDir, filePath);
    if (
      relativeFilePath.match(defaultFilesRe) ||
      cfg.assets.includes(relativeFilePath)
    ) {
      const outFilePaths = [];
      const isBaseDirFile = isPath(cfg.projectBaseDir).parentOf(filePath);

      // preserve relative hierarchy of assets in baseDir
      if (isBaseDirFile) {
        const pathRelativeToBaseDir = path.relative(
          cfg.projectBaseDir,
          filePath
        );
        for (const baseDirOutDir of baseDirOutDirs) {
          outFilePaths.push(path.join(baseDirOutDir, pathRelativeToBaseDir));
        }
      } else {
        outFilePaths.push(path.join(opts.outDir, relativeFilePath));
      }

      for (const outFilePath of outFilePaths) {
        await fse.ensureDir(path.dirname(outFilePath));
        await fse.copyFile(filePath, outFilePath);
      }
    }
  }
}
