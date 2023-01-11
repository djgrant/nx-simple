import type { ExecutorContext as BaseExecutorContext } from "@nrwl/devkit";

export type ExecutorContext = Required<BaseExecutorContext>;

export type ExecutorOptions = {
  assets?: string[];
  entry?: string;
  baseDir?: string;
  targetRuntime?: string;
};
