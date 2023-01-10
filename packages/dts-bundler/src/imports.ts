import path from "node:path";

const ImportREG = /(?:import|export)\s+.*\s+from\s+['"](.*)['"]/g;

const ImportCallREG = /import\(['"](.+)['"]\)/g;

/**
 * collect imports from file content
 */
function parseImports(content: string) {
  const imports = new Set<string>();

  content
    .replace(
      /(?:import|export)\s+.*\s+from\s+['"]([^'"]*)['"]/g,
      (_, importStatement) => {
        imports.add(importStatement);
        return _;
      }
    )
    .replace(/import\(['"]([^'"]+)['"]\)/g, (_, importStatement) => {
      imports.add(importStatement);
      return _;
    });

  return Array.from(imports);
}

function getCompileImportStr(importStr: string, realPath: string) {
  if (!importStr.startsWith(".")) {
    return importStr;
  }
  return path
    .resolve(path.dirname(realPath), importStr)
    .replace(/.*node_modules\//g, "")
    .replace(/^@types\/([^/]+)/g, (_, match) => {
      return match.replace("__", "/");
    });
}

function processImports(content: string, realpath: string) {
  const imports: string[] = [];

  const finalized = content
    .replace(ImportREG, (_, importStatement) => {
      imports.push(importStatement);

      return _.replace(
        importStatement,
        getCompileImportStr(importStatement, realpath)
      );
    })
    .replace(ImportCallREG, (_, importStatement) => {
      imports.push(importStatement);

      return _.replace(
        importStatement,
        getCompileImportStr(importStatement, realpath)
      );
    });

  return {
    imports,
    compiled: finalized,
  };
}

export function parseImportStr(importStr: string) {
  if (importStr.startsWith(".") || importStr.startsWith("/")) {
    return importStr;
  }

  const match = importStr.match(/^(@[^/]+\/[^/]+|[^/]+)/);

  if (match) {
    return match[1];
  }

  console.error("parsing import failed", importStr);

  return null;
}

export { parseImports, processImports };
