import path from "node:path";
import { randomUUID } from "node:crypto";
import { ExecutorOptions, ExecutorContext } from "utils/types";

const executionId = randomUUID();

const defaultOptions = {
  assets: [],
  entry: "index.ts",
  targetRuntime: "es2020",
};

export type Config = ReturnType<typeof getConfig>;

export function getConfig(
  userOptions: ExecutorOptions,
  context: ExecutorContext
) {
  const options = { ...defaultOptions, ...userOptions };
  const projectName = context.projectName;
  const project = context.workspace.projects[context.projectName]!;
  const projectDir = path.join(context.root, project.root);
  const projectSrcDir = options.sourceDir || projectDir;
  const projectDistDir = path.join(projectDir, "dist");

  const entryPath = path.join(projectDir, options.entry);

  const entryRelativeToProjectDir = options.entry;
  const entryRelativeToSrcDir = path.relative(projectSrcDir, entryPath);

  const workspaceDistDir = path.join(context.root, "dist");
  const tmpDir = path.join(context.root, "tmp", executionId);
  const tmpLayersDir = path.join(tmpDir, ".nxsimple");
  const layersDir = path.join(workspaceDistDir, ".nxsimple");

  return {
    ...options,
    entryPath,
    entryRelativeToProjectDir,
    entryRelativeToSrcDir,
    projectName,
    projectDir,
    projectSrcDir,
    projectDistDir,
    workspaceDistDir,
    tmpDir,
    tmpLayersDir,
    layersDir,
  };
}
