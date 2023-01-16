import path from "node:path";
import fse from "fs-extra";
import { randomUUID } from "node:crypto";
import { ExecutorContext } from "utils/types";
import { getTsConfig } from "./ts";

const executionId = randomUUID();

const defaultOptions = {
  targetRuntime: "es2020",
};

export type Config<T = unknown> = Awaited<ReturnType<typeof getConfig<T>>>;

export async function getConfig<T>(userOptions: T, context: ExecutorContext) {
  const options = { ...defaultOptions, ...userOptions };
  const projectName = context.projectName;
  const project = context.workspace.projects[context.projectName]!;
  const projectDir = path.join(context.root, project.root);

  const tsConfig = getTsConfig(projectDir);
  const packageJson = await fse.readJSON(`${projectDir}/package.json`);

  const projectBaseDir = tsConfig.options.baseUrl;

  if (!projectBaseDir) {
    throw new Error("tsconfig.json must have a baseUrl");
  }

  const projectDistDir = path.join(projectDir, "dist");

  const workspaceDistDir = path.join(context.root, "dist");
  const tmpDir = path.join(context.root, "tmp", executionId);
  const tmpLayersDir = path.join(tmpDir, ".nxsimple");
  const layersDir = path.join(workspaceDistDir, ".nxsimple");

  return {
    ...options,
    packageJson,
    projectName,
    projectDir,
    projectBaseDir,
    projectDistDir,
    workspaceDistDir,
    tmpDir,
    tmpLayersDir,
    layersDir,
    tsConfig,
  };
}
