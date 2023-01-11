import fse from "fs-extra";
import type { ProjectGraphExternalNode } from "@nrwl/devkit";
import { getPackageName, getVersion, NxSimpleNode } from "./nx.deps";
import { noExt } from "./path";

type DependencyNode = NxSimpleNode | ProjectGraphExternalNode;

type Opts = {
  projectDir: string;
  outDir: string;
  entry: string;
  publishedDependencies?: DependencyNode[];
};

export async function createPackageJson(opts: Opts) {
  const packageJson = await fse.readJSON(`${opts.projectDir}/package.json`);
  const entryNoExt = noExt(opts.entry);

  packageJson.main = `./cjs/${entryNoExt}.js`;
  packageJson.module = `./esm/${entryNoExt}.js`;
  packageJson.types = `./esm/${entryNoExt}.d.ts`;
  packageJson.dependencies = {};

  packageJson.exports = {
    ".": {
      require: packageJson.main,
      default: packageJson.module,
      types: packageJson.types,
    },
  };

  delete packageJson.type;
  delete packageJson.devDependencies;

  const isPeerDep = (v: string) =>
    (packageJson.peerDependencies || []).includes(v);

  if (opts.publishedDependencies) {
    for (const dep of opts.publishedDependencies) {
      const packageName = getPackageName(dep);
      if (packageName && !isPeerDep(packageName)) {
        packageJson.dependencies[packageName] = getVersion(dep) || "latest";
      }
    }
  }

  await fse.writeJSON(`${opts.outDir}/package.json`, packageJson, {
    spaces: 2,
  });
}
