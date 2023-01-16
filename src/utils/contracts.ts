import { ProjectGraphProjectNode, TargetConfiguration } from "@nrwl/devkit";
import { Config } from "./config";
import { isPath } from "./path";

export function validateConfig(cfg: Config) {
  const baseUrlInProjectDir = !isPath(cfg.projectBaseDir).parentOf(
    cfg.projectDir
  );
  if (!baseUrlInProjectDir) {
    throw new Error(
      `tsconfig baseUrl should not be outside the project directory\n baseUrl: ${cfg.projectBaseDir}\n soureDirectory: ${cfg.projectDir}\n`
    );
  }
}

export async function validateProjectPackageJson(
  packageJson: Record<string, any>,
  opts: { requireExports: boolean }
) {
  if (opts.requireExports) {
    if (!packageJson.main || packageJson.exports) {
      throw new Error("package.json must contain a main or exports field");
    }

    if (!packageJson.exports && !packageJson.types) {
      throw new Error("package.json must contain a types field ");
    }

    if (
      !packageJson.exports.types ||
      !Object.values(packageJson.exports).every((exp: any) => exp.types)
    ) {
      throw new Error("All package.json exports must contain a types field");
    }
  }

  // todo validate exports point to actual files
}

export function projectIsPackagableLib(node?: ProjectGraphProjectNode) {
  if (!node) return false;
  if (!node.data.targets) return false;

  const hasPackageLibExecutor = Object.values(node.data.targets).some(
    (t: any) =>
      t.executor === "nx-simple:package" && t.options.distribution === "lib"
  );

  return hasPackageLibExecutor;
}

export function projectIsBuildable(node?: ProjectGraphProjectNode) {
  if (!node) return false;
  if (!node.data.targets) return false;

  const hasBuildExecutor = Object.values(
    node.data.targets as any as TargetConfiguration[]
  ).some((target) => target.executor === "nx-simple:build");

  return hasBuildExecutor;
}

export function projectIsPublishable(node?: ProjectGraphProjectNode) {
  if (!node) return false;
  if (!node.data.targets) return false;

  const hasPublishTarget = () =>
    Object.keys(node.data.targets as any as TargetConfiguration[]).includes(
      "publish"
    );

  return (node.data as any).willPublish || hasPublishTarget();
}
