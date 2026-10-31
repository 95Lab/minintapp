import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  resolve: { alias: { "server-only": fileURLToPath(new URL("./tests/support/empty-module.ts", import.meta.url)), "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { environment: "node", include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"], clearMocks: true },
});
