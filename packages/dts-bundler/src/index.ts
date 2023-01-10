import { resolveFilesFrom } from "./resolve";

export function createTypeModule(
  filePath: string,
  basedir: string,
  tidy: boolean
) {
  const files = resolveFilesFrom(filePath, basedir);

  const fileMap = new Map<string, string>();

  return files.filter((file) => {
    if (fileMap.has(file.filePath)) {
      return false;
    }
    fileMap.set(file.filePath, file.content);
    return true;
  });
}
