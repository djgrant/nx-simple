import { ExecutorContext } from "utils/types";

export type PackageOptions = {
  distribution: "lib" | "npm" | "app";
  targetRuntime?: string;
};

export type Context = ExecutorContext;
