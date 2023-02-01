import { execSync } from "child_process";
import ts from "typescript";
import { spawn } from "./spawn";

export async function generateTsDefinitions(
  tsConfig: ts.ParsedCommandLine,
  outDir: string,
  projectDir: string
) {
  await spawn({
    cmd: "tsc",
    cmdOptions: [
      "--declaration",
      "--emitDeclarationOnly",
      ["--declarationDir", outDir],
      ["--rootDir", tsConfig.options.baseUrl!],
    ].flat(),
    cwd: projectDir,
  });

  return true;
}

export function getTsConfig(projectDir: string) {
  const configFileName = ts.findConfigFile(
    projectDir,
    ts.sys.fileExists,
    "tsconfig.json"
  );

  if (!configFileName) {
    throw new Error(`tsconfig.json not found in ${projectDir}`);
  }

  const tsConfigRaw = ts.readConfigFile(configFileName, ts.sys.readFile);

  if (tsConfigRaw.error) throw tsConfigRaw.error;

  return ts.parseJsonConfigFileContent(tsConfigRaw.config, ts.sys, projectDir);
}
