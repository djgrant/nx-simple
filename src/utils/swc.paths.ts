import path from "node:path";
import ts from "typescript";
import fse from "fs-extra";

type PathMappingOptions = {
  tsConfig: ts.ParsedCommandLine | null;
  srcDir: string;
};
export async function getSwcPathMappings(opts: PathMappingOptions) {
  if (!opts.tsConfig) return {};

  const tsBasePath = opts.tsConfig.options.baseUrl!;
  const tsPathsBasePath = opts.tsConfig.options.pathsBasePath as string;

  const isPath = (_path: string) => ({
    parentOf: (child: string) => {
      return _path.split(path.sep) < child.split(path.sep);
    },
  });

  const baseUrlInSrcDir = !isPath(tsBasePath).parentOf(opts.srcDir);
  const pathsInSrcDir = !isPath(tsPathsBasePath).parentOf(tsBasePath);

  if (!baseUrlInSrcDir) {
    throw new Error(
      `tsconfig baseUrl should not be outside the source directory\n baseUrl: ${tsBasePath}\n soureDirectory: ${opts.srcDir}\n`
    );
  }

  const swcBaseUrl = path.relative(opts.srcDir, tsBasePath) || ".";
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
