import type { ExecutorContext as BaseExecutorContext } from "@nrwl/devkit";

export type ExecutorContext = Required<BaseExecutorContext>;

export type ExecutorOptions = {
  targetRuntime?: string;
};
