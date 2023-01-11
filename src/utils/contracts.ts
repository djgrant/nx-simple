import path from "node:path";
import fse from "fs-extra";
import { ProjectGraphProjectNode, TargetConfiguration } from "@nrwl/devkit";
import { Config } from "./config";

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

export async function validateProjectPackageJson(cfg: Config) {
  const packageJson = await fse.readJSON(`${cfg.projectDir}/package.json`);
  const mainField = `dist/${path.parse(cfg.entryRelativeToProjectDir).name}.js`;

  if (!packageJson.main || packageJson.main !== mainField) {
    console.error(
      `[ERROR] ${cfg.projectName} package.json "main" field should point to ${mainField}".`
    );
    return false;
  }

  // todo: handle paths ending in "." or "./"
  const typesFile = cfg.entryRelativeToProjectDir;
  const typesFileName = path.parse(typesFile).name;

  const validTypeFields: (string | undefined)[] = [typesFile, typesFileName];

  if (typesFileName === "index") validTypeFields.push(undefined);

  if (!validTypeFields.includes(packageJson.types)) {
    console.error(
      `[WARNING] ${cfg.projectName} package.json "types" field does not point to the entry module. Set it to ${cfg.entryPath} to get intellisense support in your IDE.`
    );
  }

  return true;
}
