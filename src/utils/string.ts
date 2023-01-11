import path from "node:path";

export function noExt(p: string) {
  const { dir, name } = path.parse(p);
  return path.join(dir, name);
}
