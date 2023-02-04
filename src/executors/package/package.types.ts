import { ExecutorContext } from "utils/types";

export type PackageOptions = {
  distribution: "lib" | "npm" | "app";
  postbuild?: string;
  targetRuntime?: string;
};

export type Context = ExecutorContext;
