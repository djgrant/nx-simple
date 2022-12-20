const ts = require("typescript");

function getTsConfig(projectDir) {
  const configFileName = ts.findConfigFile(
    projectDir,
    ts.sys.fileExists,
    "tsconfig.json"
  );

  const tsConfigRaw = ts.readConfigFile(configFileName, ts.sys.readFile);

  if (tsConfigRaw.error) throw configFile.error;

  return ts.parseJsonConfigFileContent(tsConfigRaw.config, ts.sys, projectDir);
}

function getTsDiagnosticsMessages(diagnostics) {
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

module.exports = { getTsConfig, getTsDiagnosticsMessages };
