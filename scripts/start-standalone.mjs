import { cp, access } from "node:fs/promises";
import { spawn } from "node:child_process";
// Mirror the Docker runtime layout for local testing. Build must already exist.
await access(new URL("../.next/standalone/server.js", import.meta.url));
await cp(new URL("../.next/static", import.meta.url), new URL("../.next/standalone/.next/static", import.meta.url), { recursive: true });
await cp(new URL("../public", import.meta.url), new URL("../.next/standalone/public", import.meta.url), { recursive: true });
const child = spawn(process.execPath, [new URL("../.next/standalone/server.js", import.meta.url).pathname], {
  stdio: "inherit", env: { ...process.env, HOSTNAME: process.env.HOSTNAME || "0.0.0.0", PORT: process.env.PORT || "3000" },
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("error", () => { process.exitCode = 1; });
child.on("exit", (code) => { process.exitCode = code ?? 1; });
