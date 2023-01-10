import path from "node:path";
import { expect, test } from "vitest";
import { resolveFilesFrom, resolveModule } from "../resolve";

test("resole modules", () => {
  const moduleDesc = resolveModule("react", process.cwd());

  expect(moduleDesc?.packageJson?.name).toEqual("@types/react");

  expect(moduleDesc?.files.map((file) => file?.filePath)).toContain(
    "index.d.ts"
  );

  expect(moduleDesc?.deps).toEqual([
    "csstype",
    "prop-types",
    "scheduler/tracing",
  ]);
});

test("resolve file", () => {
  const fileDesc = resolveModule("./entry.d.ts", __dirname);

  expect(fileDesc?.files[0].filePath).toEqual(
    path.resolve(__dirname, "./entry.d.ts")
  );

  expect(fileDesc?.deps.map((dep) => dep.replace(__dirname, "."))).toEqual([
    "./moduleA.d",
    "./moduleB",
  ]);
});

test("resolve all files", () => {
  const files = resolveFilesFrom("./entry.d.ts", __dirname);

  expect(
    files.map((file) => file.filePath.replace(`${__dirname}/`, ""))
  ).toEqual(["entry.d.ts", "moduleA.d.ts", "moduleB.d.ts"]);
});
