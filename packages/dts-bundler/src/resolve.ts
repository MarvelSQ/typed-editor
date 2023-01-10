import path from "node:path";
import fs from "node:fs";
import resolve from "resolve";

import { parseImports, parseImportStr } from "./imports";

export function resolveFile(moduleName: string, basedir: string) {
  try {
    const filePath = path.resolve(basedir, moduleName);

    const fileName = path.basename(filePath);

    const subfiles = fs.readdirSync(path.dirname(filePath), {
      withFileTypes: true,
    });

    let realPath: string | null = null;

    subfiles.some((file) => {
      if (file.name === fileName) {
        if (file.isDirectory()) {
          realPath = path.resolve(filePath, "index.d.ts");
        } else {
          realPath = filePath;
        }
      }
      if (file.name === fileName + ".d.ts") {
        realPath = filePath + ".d.ts";
      }
      if (file.name === fileName + ".ts") {
        realPath = filePath + ".ts";
      }

      return !!realPath;
    });

    if (!realPath) {
      return;
    }

    const content = fs.readFileSync(realPath, "utf-8");
    return {
      filePath: realPath,
      content,
    };
  } catch (err) {
    console.log("reading", moduleName, "from", basedir);
    console.error(err);
  }
}

type PackageJSON = {
  name: string;
  types?: string;
  typings?: string;
};

export function resolvePackageJSON(packageName: string, basedir: string) {
  try {
    const jsonFilePath = resolve.sync(`${packageName}/package.json`, {
      basedir,
    });

    return {
      filePath: fs.realpathSync(jsonFilePath),
      json: JSON.parse(fs.readFileSync(jsonFilePath, "utf-8")) as PackageJSON,
    };
  } catch (err) {
    console.log("resolve package", packageName, "failed");
    console.error(err);
  }
}

export function resolvePackageDeclaration(
  packageName: string,
  basedir: string
) {
  const packageJSON = resolvePackageJSON(packageName, basedir);

  const hasTyping =
    packageName.startsWith("@types/") ||
    packageJSON?.json.types ||
    packageJSON?.json.typings;

  const typingPackageName = `@types/${packageName.replace("/", "__")}`;

  const typingPackageJSON = hasTyping
    ? packageJSON
    : resolvePackageJSON(typingPackageName, basedir);

  return {
    packageName,
    packageRoot: packageJSON ? path.dirname(packageJSON.filePath) : undefined,
    packageJSON: packageJSON?.json,
    typing: hasTyping
      ? undefined
      : {
          packageName: typingPackageName,
          packageRoot: typingPackageJSON
            ? path.dirname(typingPackageJSON.filePath)
            : undefined,
          packageJSON: typingPackageJSON?.json,
        },
  };
}

function collectAllDTSFile(basedir: string) {
  const files = fs.readdirSync(basedir, {
    withFileTypes: true,
  });

  const dtsFiles: {
    filePath: string;
    content: string;
  }[] = files.flatMap((file) => {
    if (file.isDirectory()) {
      return collectAllDTSFile(path.resolve(basedir, file.name));
    }
    if (file.name.endsWith(".d.ts")) {
      return [
        {
          filePath: path.resolve(basedir, file.name),
          content: fs.readFileSync(path.resolve(basedir, file.name), "utf-8"),
        },
      ];
    }
    return [];
  });

  return dtsFiles;
}

export function resolveModule(moduleName: string, basedir: string) {
  if (moduleName.startsWith(".") || moduleName.startsWith("/")) {
    const resolvedFile = resolveFile(moduleName, basedir);

    if (!resolvedFile) {
      return null;
    }

    return {
      files: [resolvedFile],
      deps: parseImports(resolvedFile.content).map((file) => {
        if (file.startsWith(".")) {
          return path.resolve(path.dirname(resolvedFile.filePath), file);
        }
        return file;
      }),
    };
  }

  const packageName = parseImportStr(moduleName);

  if (!packageName) {
    return;
  }

  const packageDesc = resolvePackageDeclaration(packageName, basedir);

  const rootPath = packageDesc.typing?.packageRoot || packageDesc.packageRoot;

  const json = packageDesc.typing?.packageJSON || packageDesc.packageJSON;

  if (rootPath) {
    const files = collectAllDTSFile(rootPath);

    return {
      packageName,
      packageJson: json,
      files: files.map((file) => ({
        filePath: path.relative(rootPath, file.filePath),
        content: file.content,
      })),
      packageRoot: rootPath,
      deps: Array.from(
        new Set(
          files.flatMap((file) => {
            const deps = parseImports(file.content);
            return deps.filter(
              (dep) =>
                dep !== packageName &&
                !dep.startsWith(`${packageName}/`) &&
                !dep.startsWith(".")
            );
          })
        )
      ),
    };
  }

  return null;
}

export function resolveFilesFrom(entry: string, basedir: string) {
  const moduleMap = new Map<string, string>();

  const files: {
    filePath: string;
    content: string;
  }[] = [];

  function loopDeps(dep: string, basedir: string) {
    const desc = resolveModule(dep, basedir);

    if (!desc) {
      return;
    }

    moduleMap.set(desc.packageName || dep, basedir);
    desc.packageJson?.name && moduleMap.set(desc.packageJson.name, basedir);

    if (desc.packageJson) {
      const jsonPackageName = desc.packageJson.name;
      files.push({
        filePath: `${jsonPackageName}/package.json`,
        content: JSON.stringify(desc.packageJson),
      });
      files.push(
        ...desc.files.map((file) => ({
          filePath: `${jsonPackageName}/${file.filePath}`,
          content: file.content,
        }))
      );
    } else {
      files.push(...desc.files);
    }

    desc.deps.map((dep) => {
      const depName = parseImportStr(dep);

      if (depName && moduleMap.has(depName)) {
        return;
      }

      loopDeps(dep, desc.packageRoot || basedir);
    });
  }

  loopDeps(entry, basedir);

  return files;
}
