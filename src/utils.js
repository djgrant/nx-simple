// @ts-check
const ts = require("typescript");
const path = require("path");
const { execSync } = require("child_process");

function getProject(context) {
  return context.workspace.projects[context.projectName];
}

function stripTsExtension(filePath) {
  return filePath.replace(/\.tsx?$/, "");
}

function getTsConfig(projectDir) {
  const configFileName = ts.findConfigFile(
    projectDir,
    ts.sys.fileExists,
    "tsconfig.json"
  );

  if (!configFileName) return null;

  const tsConfigRaw = ts.readConfigFile(configFileName, ts.sys.readFile);

  if (tsConfigRaw.error) throw tsConfigRaw.error;

  return ts.parseJsonConfigFileContent(tsConfigRaw.config, ts.sys, projectDir);
}

function getTsMessages(diagnostics) {
  const msgs = [];
  diagnostics.forEach((diagnostic) => {
    if (diagnostic.file) {
      let { line, character } = ts.getLineAndCharacterOfPosition(
        diagnostic.file,
        diagnostic.start
      );
      let message = ts.flattenDiagnosticMessageText(
        diagnostic.messageText,
        "\n"
      );
      msgs.push(
        `${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`
      );
    } else {
      msgs.push(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
    }
  });
  return msgs;
}

function runSwc({
  projectDir,
  srcDir,
  outDir,
  ignoreDir,
  moduleType,
  target,
  sourceMaps,
}) {
  const cwd =
    path.relative(srcDir, projectDir) === ""
      ? path.resolve(projectDir, "../")
      : projectDir;

  const fromCwd = (targetPath) => path.relative(cwd, targetPath) || ".";

  const cmdParts = [
    `npx swc ${fromCwd(srcDir)}`,
    `--ignore ${fromCwd(ignoreDir)}`,
    `--out-dir ${fromCwd(outDir)}`,
    `-C module.type=${moduleType}`,
    `-C jsc.target=${target}`,
    sourceMaps ? "-C sourceMaps" : null,
  ];

  const cmd = cmdParts.filter(Boolean).join(" ");
  const stdout = execSync(cmd, { cwd });
  const output = stdout.toString().replace(/\n/, "");

  console.log(output);
}

module.exports = {
  getProject,
  getTsConfig,
  getTsMessages,
  runSwc,
  stripTsExtension,
};
