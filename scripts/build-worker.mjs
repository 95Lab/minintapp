import { build } from "esbuild";
import { mkdir, copyFile } from "node:fs/promises";
await mkdir(".platform", { recursive: true });
await build({ entryPoints: ["platform/worker.ts"], bundle: true, platform: "node", target: "node22", format: "esm", outfile: ".platform/worker.mjs",
  alias: { "server-only": "./platform/server-only-shim.ts" }, external: ["pg-native"],
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});
await copyFile("platform/schema.sql", ".platform/schema.sql");
