import cp from "node:child_process";

export function spawn(opts: {
  cmd: string;
  cmdOptions: string[];
  cwd: string;
  logger?: (msg: string) => void;
}) {
  return new Promise<void>((resolve, reject) => {
    const proc = cp.spawn(opts.cmd, opts.cmdOptions, {
      cwd: opts.cwd,
      stdio: "pipe",
    });

    if (!proc.stdout || !proc.stderr) {
      return reject(`Failed to spawn ${opts.cmd} ${opts.cmdOptions.join(" ")}`);
    }

    let msgs: string[] = [];

    proc.stdout.on("data", (data) => {
      if (opts.logger) opts.logger(data.toString());
      else msgs.push(data.toString());
    });

    proc.stderr.on("data", (data) => {
      if (opts.logger) opts.logger(data.toString());
      else msgs.push(data.toString());
    });

    proc.on("close", (code) => {
      if (code !== 0) return reject(msgs.join("\n"));
      return resolve();
    });
  });
}
