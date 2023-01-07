import fse from "fs-extra";
import { ProjectNode } from "./nx.deps";

type Opts = {
  projectDir: string;
  outDir: string;
  entryModuleName: string;
  dependencies?: ProjectNode[];
};

export async function createPackageJson(opts: Opts) {
  const packageJson = await fse.readJSON(`${opts.projectDir}/package.json`);

  packageJson.main = `cjs/${opts.entryModuleName}.js`;
  packageJson.module = `esm/${opts.entryModuleName}.js`;
  packageJson.types = `types/${opts.entryModuleName}.d.ts`;

  delete packageJson.type;
  delete packageJson.devDependencies;

  if (opts.dependencies) {
    packageJson.dependencies = opts.dependencies
      .filter((dep) => {
        if (!packageJson.peerDependencies) return true;
        if (!dep.packageName) return false;
        return !packageJson.peerDependencies.includes(dep.packageName);
      })
      .reduce(
        (acc, dep) => ({ ...acc, [dep.packageName!]: dep.data.version }),
        {}
      );
  }

  await fse.writeJSON(`${opts.outDir}/package.json`, packageJson, {
    spaces: 2,
  });
}
