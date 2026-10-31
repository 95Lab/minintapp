// Local container verification. gVisor/firewall enforcement must additionally be tested on Linux.
import { execFileSync } from "node:child_process";
import { randomBytes, createHash } from "node:crypto";
import assert from "node:assert/strict";
import { composeSpec } from "../src/lib/app-spec/app-spec-examples";
const prefix = `minint-smoke-${randomBytes(4).toString("hex")}`;
const image = process.env.LOCAL_RUNTIME_IMAGE || "minintapp-refine:local";
const ids = [randomBytes(12).toString("hex"), randomBytes(12).toString("hex")];
const token = randomBytes(32).toString("hex");
const docker = (...args: string[]) => execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const bases: string[] = [];
async function api(index: number, path: string, body?: unknown, headers = {}) {
  return fetch(`${bases[index]}${path}`, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", ...headers }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10000) });
}
try {
  for (let index = 0; index < 2; index++) {
    const resource = `${prefix}-${index}`;
    const seed = { id: ids[index], spec: composeSpec(), prompt: "SQLite smoke", ownerId: "test", hostTokenHash: createHash("sha256").update(token).digest("hex"), createdAt: Date.now(), expiresAt: Date.now() + 600000 };
    docker("network", "create", resource);
    docker("volume", "create", resource);
    docker("run", "-d", "--name", resource, "--network", resource, "--memory", "512m", "--cpus", "0.5", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges:true", "--tmpfs", "/tmp:rw,size=64m", "--mount", `type=volume,src=${resource},dst=/data`, "-p", "127.0.0.1::3000", "-e", "PLATFORM_ROLE=runtime", "-e", `RUNTIME_APP_ID=${ids[index]}`, "-e", `RUNTIME_SEED=${Buffer.from(JSON.stringify(seed)).toString("base64")}`, "-e", `RUNTIME_TOKEN=${token}`, "-e", `APP_ORIGIN=https://${ids[index]}.example.test`, image);
    const inspect = JSON.parse(docker("inspect", resource))[0];
    bases.push(`http://127.0.0.1:${inspect.NetworkSettings.Ports["3000/tcp"][0].HostPort}`);
    let healthy = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      try { const result = await api(index, "/api/health"); if (result.ok && (await result.json()).appId === ids[index]) { healthy = true; break; } } catch { /* startup */ }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    assert(healthy, "Runtime startup failed");
  }
  const spec = composeSpec(), block = spec.blocks[0]; if (block.type !== "compose") throw Error();
  const input = block.inputs[0]; if (input.kind !== "choice") throw Error();
  const body = { blockId: block.id, itemId: "", participantToken: "a".repeat(64), displayName: null, payload: { kind: "compose", values: { [input.id]: input.options![0].id } } };
  assert.equal((await api(0, `/api/apps/${ids[0]}/responses`, body)).status, 200);
  assert.equal((await api(1, `/api/apps/${ids[0]}/state`)).status, 404);
  assert.equal((await api(0, "/api/internal/runtime", { op: "snapshot", args: [] })).status, 404);
  assert.equal((await api(0, "/api/apps/from-template", { templateId: "poll-drinks" })).status, 403);
  docker("restart", `${prefix}-0`);
  const restarted = JSON.parse(docker("inspect", `${prefix}-0`))[0];
  bases[0] = `http://127.0.0.1:${restarted.NetworkSettings.Ports["3000/tcp"][0].HostPort}`;
  let restored = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    try { const state = await api(0, `/api/apps/${ids[0]}/state`); if (state.ok && (await state.json()).participantCount === 1) { restored = true; break; } } catch { /* startup */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert(restored, "SQLite data did not survive restart");
  docker("stop", `${prefix}-0`);
  assert.equal((await api(1, `/api/apps/${ids[1]}/state`)).status, 200);
  console.log("Container smoke passed: dedicated SQLite volumes, restart persistence, app ID isolation, private RPC, creation disabled, independent stop.");
} finally {
  for (let index = 0; index < 2; index++) {
    const resource = `${prefix}-${index}`;
    for (const args of [["rm", "-f", resource], ["network", "rm", resource], ["volume", "rm", resource]]) {
      try { docker(...args); } catch { /* Only remove resources created by this test invocation. */ }
    }
  }
}
