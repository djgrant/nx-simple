import path from "node:path";
import { stripTsExtension } from "utils/ts";
import { Options, Context } from "./build-package.types";

export function getConfig(options: Options, context: Context) {
  const project = context.workspace.projects[context.projectName]!;
  const projectDir = path.join(context.root, project.root);
  const entry = `${projectDir}/${options.entry}`;
  const projectSrcDir = path.dirname(entry);
  const projectDistDir = path.join(projectDir, "dist");
  const entryModuleName = stripTsExtension(path.relative(projectSrcDir, entry));

  const workspaceDistDir = path.join(context.root, "dist");
  const tmpDir = path.join(context.root, "tmp", process.env.EXECUTION_ID!);
  const tmpLayersDir = path.join(tmpDir, ".nxsimple");
  const layersDir = path.join(workspaceDistDir, ".nxsimple"); // this might be better in the tmp dir

  return {
    project,
    projectDir,
    entry,
    projectSrcDir,
    projectDistDir,
    workspaceDistDir,
    tmpDir,
    tmpLayersDir,
    layersDir,
    entryModuleName,
  };
}
