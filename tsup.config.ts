import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { cli: "bin/flare.ts" },
    format: ["esm"],
    target: "node22",
    outDir: "dist",
    clean: true,
    sourcemap: true,
    splitting: false,
    shims: true,
    silent: true,
    external: ["playwright"],
    banner: {
      js: "#!/usr/bin/env node",
    },
    onSuccess: async () => {
      console.log("🔥 CLI build success");
    },
  },
  {
    entry: { index: "src/index.ts" },
    format: ["esm"],
    target: "node22",
    outDir: "dist",
    dts: true,
    sourcemap: true,
    splitting: false,
    shims: true,
    silent: true,
    external: ["playwright"],
    onSuccess: async () => {
      console.log("🔥 Library + types build success");
    },
  },
]);
