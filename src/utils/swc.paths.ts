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

  const hasValidBaseUrl = !isPath(tsBasePath).parentOf(opts.srcDir);
  const hasValidPaths = !isPath(tsPathsBasePath).parentOf(tsBasePath);

  if (!hasValidBaseUrl) {
    throw new Error(
      `tsconfig baseUrl should not be a higher directory than the project entry module\n baseUrl: ${tsBasePath}\nentryDir: ${opts.srcDir}\n`
    );
  }

  const swcBaseUrl = path.relative(opts.srcDir, tsBasePath) || ".";
  const swcPaths: Record<string, string[]> = {};

  if (opts.tsConfig.options.paths && hasValidPaths) {
    for (const [pathKey, locations] of Object.entries(
      opts.tsConfig.options.paths
    )) {
      if (locations.some((l) => l.startsWith(".."))) {
        throw new Error(
          `Path mapping "${pathKey}" contains locations outside source directory.`
        );
      }
      swcPaths[pathKey] = locations.map((l) => path.join(swcBaseUrl, l));
    }
  }

  if (hasValidBaseUrl) {
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
  }

  return { baseUrl: swcBaseUrl, paths: swcPaths };
}
