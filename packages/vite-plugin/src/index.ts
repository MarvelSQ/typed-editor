import { dirname, resolve } from "node:path";
import { PluginOption } from "vite";
import { createTypeModule } from "@marvelsq/dts-bundler";

export type DtsOption = {};

const dtsPlugin = (option?: DtsOption): PluginOption => {
  return {
    name: "dts-plugin",
    enforce: "pre",
    apply: "build",
    resolveId(id, importer) {
      if (id.endsWith("?dts")) {
        const file = resolve(
          importer ? dirname(importer) : process.cwd(),
          id.replace("?dtx", "")
        );
        return `${file}?dts`;
      }
    },
    load(id) {
      const module = id.slice(0, -4);

      const pwd = process.cwd();

      const filePath = module.startsWith(pwd)
        ? module
        : resolve(process.cwd() + module);

      const files = createTypeModule(filePath, pwd);

      return `export default ${JSON.stringify(files, null, 2)}`;
    },
  };
};

export { dtsPlugin };
