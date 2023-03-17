import type { ProjectGraphExternalNode } from "@nrwl/devkit";
import { getPackageName, getVersion, NxSimpleNode } from "./nx.deps";

type DependencyNode = NxSimpleNode | ProjectGraphExternalNode;

type Opts = {
  sourcePackageJson: Record<string, any>;
  publishedDependencies?: DependencyNode[];
};

// ensure main is relative path
const distRelativeRe = [/^dist\//, "./dist/"];
const distToDistCjsRe = [/^(\.\/)?dist\//, "./dist-cjs/"];

export async function createPackageJson(opts: Opts) {
  const packageJson = { ...opts.sourcePackageJson };
  const peerDeps = packageJson.peerDependencies;
  const exportMap: Record<string, { import: string; require: string }> = {};

  // 1. Strip fields
  delete packageJson.type; // defined in dist directories
  delete packageJson.types; // types are resolved by adjacent .d.ts
  delete packageJson.devDependencies; // non-prod field
  delete packageJson.peerDependencies; // added back, in nice order, after other fields are added

  // 2. Remap main field
  if (packageJson.main) {
    packageJson.module = packageJson.main.replace(...distRelativeRe);
    packageJson.main = packageJson.main.replace(...distToDistCjsRe);
    exportMap["."] = {
      require: packageJson.main,
      import: packageJson.module,
    };
  }

  // 3. Remap exports
  if (packageJson.exports) {
    for (const subpath of Object.keys(packageJson.exports)) {
      const exportDef = packageJson.exports[subpath];
      const importPath = exportDef.import || exportDef.default;

      if (!importPath) {
        throw new Error(
          `Export ${subpath} for package ${packageJson.name} does not have an import or default property`
        );
      }

      exportMap[subpath] = {
        import: importPath,
        require: importPath.replace(...distToDistCjsRe),
      };
    }

    const mainExport = exportMap["."];

    if (mainExport) {
      packageJson.main = mainExport.require;
      packageJson.module = mainExport.import;
    }
  }

  if (Object.keys(exportMap).length) {
    packageJson.exports = exportMap;
  }

  // 4. Resolve dependencies
  packageJson.dependencies = {};

  const isPeerDep = (v: string) => Object.keys(peerDeps || {}).includes(v);

  if (opts.publishedDependencies) {
    for (const dep of opts.publishedDependencies) {
      const packageName = getPackageName(dep);
      if (packageName && !isPeerDep(packageName)) {
        packageJson.dependencies[packageName] = getVersion(dep) || "latest";
      }
    }
  }

  // 5. Add peer deps back in aesthetic order
  if (peerDeps) {
    packageJson.peerDependencies = peerDeps;
  }

  return packageJson;
}
