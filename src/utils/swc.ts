const path = require("path");
const { execSync } = require("child_process");

type SwcOpts = {
  projectDir: string;
  srcDir: string;
  outDir: string;
  ignoreDir: string;
  moduleType: "es6" | "commonjs";
  target: string;
  sourceMaps: boolean;
};

export function runSwc(opts: SwcOpts) {
  const cwd =
    path.relative(opts.srcDir, opts.projectDir) === ""
      ? path.resolve(opts.projectDir, "../")
      : opts.projectDir;

  const fromCwd = (targetPath: string) => path.relative(cwd, targetPath) || ".";

  const cmdParts = [
    `npx swc ${fromCwd(opts.srcDir)}`,
    `--ignore ${fromCwd(opts.ignoreDir)}`,
    `--out-dir ${fromCwd(opts.outDir)}`,
    `-C module.type=${opts.moduleType}`,
    `-C jsc.target=${opts.target}`,
    opts.sourceMaps ? "-C sourceMaps" : null,
  ];

  const cmd = cmdParts.filter(Boolean).join(" ");
  const stdout = execSync(cmd, { cwd });
  const output = stdout.toString().replace(/\n/, "");

  console.log(output);
}
