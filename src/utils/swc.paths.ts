import path from "node:path";
import ts from "typescript";
import fse from "fs-extra";
import { isPath } from "./path";

type PathMappingOptions = {
  tsConfig: ts.ParsedCommandLine;
};

export async function getSwcPathMappings(opts: PathMappingOptions) {
  const resolvedBaseUrl = opts.tsConfig.options.baseUrl!;
  const tsPathsBasePath = opts.tsConfig.options.pathsBasePath as string;
  const pathsInSrcDir = !isPath(tsPathsBasePath).parentOf(resolvedBaseUrl);
  const swcPaths: Record<string, string[]> = {};

  if (opts.tsConfig.options.paths && pathsInSrcDir) {
    for (const [pathKey, locations] of Object.entries(
      opts.tsConfig.options.paths
    )) {
      if (locations.some((l) => l.startsWith(".."))) {
        throw new Error(
          `Path mapping "${pathKey}" contains locations outside the source directory.`
        );
      }
      swcPaths[pathKey] = locations.map((l) => path.join(resolvedBaseUrl, l));
    }
  }

  const baseChildDirents = await fse
    .readdir(resolvedBaseUrl, { withFileTypes: true })
    .catch(() => {
      throw new Error(`baseUrl ${resolvedBaseUrl} does not exist`);
    });

  for (const child of baseChildDirents) {
    if (child.name === "dist") continue;
    if (child.isDirectory()) {
      swcPaths[`${child.name}/*`] = [`${child.name}/*`];
    } else {
      const compiledPath = child.name.replace(/\.tsx?$/, ".js");
      swcPaths[compiledPath] = [child.name];
    }
  }

  return { baseUrl: resolvedBaseUrl, paths: swcPaths };
}
