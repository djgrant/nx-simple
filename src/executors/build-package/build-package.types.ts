import type { ExecutorContext } from "@nrwl/devkit";

export type Options = {
  assets?: string[];
  distribution: "internal" | "external" | "layer";
  entry?: string;
  targetRuntime?: string;
};

export type Context = Required<ExecutorContext>;
