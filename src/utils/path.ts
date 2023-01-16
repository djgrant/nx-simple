import path from "node:path";

export function noExt(p: string) {
  const { dir, name } = path.parse(p);
  return path.join(dir, name);
}

export const isPath = (_path: string) => ({
  parentOf: (child: string) => {
    return _path.split(path.sep) < path.dirname(child).split(path.sep);
  },
});
