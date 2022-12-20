export interface BuildExecutorSchema {
  assets?: string[];
  entry?: string;
  esbuild?: Record<string, any>;
  strategy: "internal" | "external";
}
