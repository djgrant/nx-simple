import path from "node:path";
import fse from "fs-extra";
import type { ProjectGraphExternalNode } from "@nrwl/devkit";
import { getPackageName, getVersion, NxSimpleNode } from "./nx.deps";

type DependencyNode = NxSimpleNode | ProjectGraphExternalNode;

type Opts = {
  projectDir: string;
  outDir: string;
  entry: string;
  dependencies?: DependencyNode[];
};

export async function createPackageJson(opts: Opts) {
  const packageJson = await fse.readJSON(`${opts.projectDir}/package.json`);
  const entryNoExt = path.parse(opts.entry).name;

  packageJson.main = `cjs/${entryNoExt}.js`;
  packageJson.module = `esm/${entryNoExt}.js`;
  packageJson.types = `types/${entryNoExt}.d.ts`;

  delete packageJson.type;
  delete packageJson.devDependencies;

  if (opts.dependencies && packageJson.peerDependencies) {
    for (const dep of opts.dependencies) {
      const packageName = getPackageName(dep);
      if (packageName && packageJson.peerDependencies.includes(packageName)) {
        packageJson.dependencies[packageName] = getVersion(dep) || "latest";
      }
    }
  }

  await fse.writeJSON(`${opts.outDir}/package.json`, packageJson, {
    spaces: 2,
  });
}
