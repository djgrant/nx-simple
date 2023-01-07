import type {
  ProjectGraphProjectNode,
  TargetConfiguration,
} from "@nrwl/devkit";
import fse from "fs-extra";
import { stripTsExtension } from "./ts";

export function projectIsBuildable(node?: ProjectGraphProjectNode) {
  if (!node?.data.targets) return false;

  const hasBuildExecutor = Object.values(
    node.data.targets as TargetConfiguration[]
  ).some((target) => target.executor === "nx-simple:build-package");

  return hasBuildExecutor;
}

export function projectIsPublishable(node?: ProjectGraphProjectNode) {
  if (!node?.data.targets) return false;

  const hasPublishTarget = () =>
    Object.keys(node.data.targets as TargetConfiguration[]).includes("publish");

  return node.data.willPublish || hasPublishTarget();
}

export async function validateInternalPackageJson(opts: {
  projectName: string;
  projectDir: string;
  entryModuleName: string;
  entry: string;
}) {
  const packageJson = await fse.readJSON(`${opts.projectDir}/package.json`);
  const expectedMainField = `dist/${opts.entryModuleName}.js`;
  const validTypeFields: (string | undefined)[] = [
    opts.entry,
    stripTsExtension(opts.entry),
  ];

  if (opts.entryModuleName === "index") validTypeFields.push(undefined);

  if (!packageJson.main || !packageJson.main.startsWith(expectedMainField)) {
    console.error(
      `[ERROR] ${opts.projectName} package.json "main" field should point to ${expectedMainField}.js".`
    );
    return false;
  }

  if (!validTypeFields.includes(packageJson.types)) {
    console.error(
      `[WARNING] ${opts.projectName} package.json "types" field does not point to the entry module. Set it to ${opts.entry} to get intellisense support in your IDE.`
    );
  }

  return true;
}
