import { Config } from "@swc/core";

export interface BuildExecutorSchema {
  assets?: string[];
  distribution: "internal" | "external";
  entry?: string;
  target?: string;
}
