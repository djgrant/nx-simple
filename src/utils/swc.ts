import path from "node:path";
import fse from "fs-extra";
import { spawn } from "utils/spawn";
import { randomUUID } from "node:crypto";

type SwcOpts = {
  projectDir: string;
  srcDir: string;
  outDir: string;
  ignoreDir: string;
  moduleType: "es6" | "commonjs";
  target: string;
  sourceMaps: boolean;
  baseUrl?: string;
  paths?: Record<string, string[]>;
};

export async function runSwc(opts: SwcOpts) {
  const cwd =
    path.relative(opts.srcDir, opts.projectDir) === ""
      ? path.resolve(opts.projectDir, "../")
      : opts.projectDir;

  const fromCwd = (targetPath: string) => path.relative(cwd, targetPath) || ".";

  let userConfig;
  try {
    userConfig = await fse.readJson(`${opts.projectDir}/.swcrc`, {
      throws: false,
    });
  } catch {
    userConfig = {};
  }

  // todo: for transparency break into user, default and immutable and merge
  const swcConfig = {
    sourceMaps: opts.sourceMaps, // immutable
    ...userConfig,
    exclude: [fromCwd(opts.ignoreDir), ...(userConfig.exclude || [])],
    module: {
      ...userConfig.module,
      type: opts.moduleType, // immutable
    },
    jsc: {
      ...userConfig.jsc,
      baseUrl: opts.baseUrl && fromCwd(opts.baseUrl), // immutable
      target: opts.target, // immutable
      paths: {
        ...opts.paths,
        ...userConfig.paths,
      },
      parser: {
        ...userConfig.jsc?.parser,
        syntax: "typescript", // immutable
      },
    },
  };

  const swcrcPath = `/tmp/.swcrc-${randomUUID()}`;
  await fse.writeJSON(swcrcPath, swcConfig);

  const cmdOptions = [
    "swc",
    fromCwd(opts.srcDir),
    ["--out-dir", fromCwd(opts.outDir)],
    ["--config-file", swcrcPath],
    "--no-swcrc",
  ].flatMap((v) => v);

  await spawn({ cmd: "npx", cmdOptions, cwd, logger: console.log });
}
