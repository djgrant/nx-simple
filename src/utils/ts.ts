import ts from "typescript";

export function generateTsDefinitions(
  entry: string,
  projectDir: string,
  publishDir: string
) {
  const tsConfig = getTsConfig(projectDir);

  const program = ts.createProgram({
    rootNames: [entry],
    options: {
      ...(tsConfig?.options || {}),
      declaration: true,
      emitDeclarationOnly: true,
      declarationDir: `${publishDir}/types`,
    },
  });

  let emitResult = program.emit();

  let diagnostics = ts
    .getPreEmitDiagnostics(program)
    .concat(emitResult.diagnostics);

  const messages = getTsMessages(diagnostics);

  if (messages.length) {
    console.error(messages.join("\n"));
    return false;
  }

  return true;
}

export function stripTsExtension(filePath: string) {
  return filePath.replace(/\.tsx?$/, "");
}

export function getTsConfig(projectDir: string) {
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

function getTsMessages(diagnostics: ts.Diagnostic[]) {
  const msgs: string[] = [];
  diagnostics.forEach((diagnostic) => {
    if (diagnostic.file) {
      let { line, character } = ts.getLineAndCharacterOfPosition(
        diagnostic.file,
        diagnostic.start!
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
