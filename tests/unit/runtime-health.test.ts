import { createServer } from "node:http";
import { expect, it } from "vitest";
import { runtimeHealth } from "../../platform/runtime-health";

it("routes gateway probes with the app Host and validates runtime identity", async () => {
  const server = createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ service: "minintapp", appId: req.headers.host === "app.example.test" ? "app" : "wrong" }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  const url = `http://127.0.0.1:${address.port}/api/health`;
  try {
    await expect(runtimeHealth(url, "app", { Host: "app.example.test" })).resolves.toBeUndefined();
    await expect(runtimeHealth(url, "other", { Host: "app.example.test" })).rejects.toThrow("Runtime health check failed");
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
});

it("reaches a public app through the ingress name without resolving the app hostname", async () => {
  const server = createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ service: "minintapp", appId: req.headers.host?.split(":")[0] === "unresolvable-app.invalid" ? "app" : "wrong" }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  const url = `http://unresolvable-app.invalid:${address.port}/api/health`;
  try {
    await expect(runtimeHealth(url, "app", undefined, "localhost")).resolves.toBeUndefined();
    await expect(runtimeHealth(url, "app")).rejects.toThrow();
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
});
