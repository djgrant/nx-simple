import { Options, Context } from "./build-package.types";
import { runExternalExecutor } from "./build-package.external";
import { runInternalExecutor } from "./build-package.internal";
import { runLayerExecutor } from "./build-package.layer";
import { randomUUID } from "crypto";

export default async function runExecutor(options: Options, context: Context) {
  if (!process.env.EXECUTION_ID) {
    process.env.EXECUTION_ID = process.env.EXECUTION_ID || randomUUID();

    if (options.distribution === "layer") {
      throw new Error(
        "distribution=layer is for internal use by the executor. Do not use"
      );
    }
  }

  const defaultOptions = {
    assets: [],
    entry: "index.ts",
    targetRuntime: "es2020",
  };

  const mergedOptions = {
    ...defaultOptions,
    ...options,
  };

  switch (options.distribution) {
    case "external":
      return runExternalExecutor(mergedOptions, context);
    case "layer":
      return runLayerExecutor(mergedOptions, context);
    case "internal":
      return runInternalExecutor(mergedOptions, context);
  }
}
