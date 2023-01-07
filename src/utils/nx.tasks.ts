import { spawn } from "./spawn";

export function runTask(opts: {
  project: string;
  target: string;
  overrides: Record<string, string>;
  cwd: string;
  logger?: (msg: string) => void;
}) {
  const flags = Object.entries(opts.overrides).map(
    ([key, value]) => `--${key}=${value}`
  );

  const cmdOptions = ["nx", opts.target, opts.project, ...flags];

  return spawn({
    cmd: "npx",
    cmdOptions,
    cwd: opts.cwd,
    logger: opts.logger,
  });
}
