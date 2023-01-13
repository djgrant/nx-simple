import fse from "fs-extra";
import { ProjectGraphProjectNode, TargetConfiguration } from "@nrwl/devkit";
import { Config } from "./config";
import { isPath, noExt } from "./path";

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

export async function validateProjectPackageJson(cfg: Config) {
  const packageJson = await fse.readJSON(`${cfg.projectDir}/package.json`);

  // 1. Warnings
  // todo: handle paths ending in "." or "./"
  const typesFile = cfg.entryRelativeToProjectDir;
  const typesFileName = noExt(typesFile);

  const validTypeFields: (string | undefined)[] = [typesFile, typesFileName];

  if (typesFileName === "index") validTypeFields.push(undefined);

  if (!validTypeFields.includes(packageJson.types)) {
    console.warn(
      `[WARNING] ${cfg.projectName} package.json "types" field does not point to the entry module. Set it to ${cfg.entryPath} to get intellisense support in your IDE.`
    );
  }

  // 2. Errors
  const mainField = `dist/${noExt(cfg.entryRelativeToBaseDir)}.js`;

  if (!packageJson.main || packageJson.main !== mainField) {
    throw new Error(
      `${cfg.projectName} package.json "main" field should point to ${mainField}".`
    );
  }
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
