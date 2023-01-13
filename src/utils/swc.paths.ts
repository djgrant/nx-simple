import path from "node:path";
import ts from "typescript";
import fse from "fs-extra";
import { isPath } from "./path";

type PathMappingOptions = {
  srcDir: string;
  tsConfig: ts.ParsedCommandLine;
};
export async function getSwcPathMappings(opts: PathMappingOptions) {
  const tsBasePath = opts.tsConfig.options.baseUrl!;
  const tsPathsBasePath = opts.tsConfig.options.pathsBasePath as string;

  const swcBaseUrl = path.relative(opts.srcDir, tsBasePath) || ".";
  const swcPaths: Record<string, string[]> = {};

  const pathsInSrcDir = !isPath(tsPathsBasePath).parentOf(tsBasePath);

  if (opts.tsConfig.options.paths && pathsInSrcDir) {
    for (const [pathKey, locations] of Object.entries(
      opts.tsConfig.options.paths
    )) {
      if (locations.some((l) => l.startsWith(".."))) {
        throw new Error(
          `Path mapping "${pathKey}" contains locations outside the source directory.`
        );
      }
      swcPaths[pathKey] = locations.map((l) => path.join(swcBaseUrl, l));
    }
  }

  const baseChildDirents = await fse
    .readdir(tsBasePath, { withFileTypes: true })
    .catch(() => {
      throw new Error(`baseUrl ${tsBasePath} does not exist`);
    });

  for (const child of baseChildDirents) {
    if (child.isDirectory()) {
      swcPaths[`${child.name}/*`] = [`${child.name}/*`];
    } else {
      swcPaths[`${child.name}`] = [`${child.name}`];
    }
  }

  return { baseUrl: swcBaseUrl, paths: swcPaths };
}
