import { ExecutorContext, ExecutorOptions } from "utils/types";

export type Options = ExecutorOptions & {
  distribution: "lib" | "npm" | "app";
};

export type Context = ExecutorContext;
