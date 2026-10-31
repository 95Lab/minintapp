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
const postgres = `${prefix}-postgres`;
let database: typeof import("./app-database") | undefined;
let adminPool: typeof import("./store").pool | undefined;
async function api(index: number, path: string, body?: unknown, headers = {}) {
  return fetch(`${bases[index]}${path}`, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", ...headers }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10000) });
}
try {
  docker("run", "-d", "--name", postgres, "--memory", "384m", "-e", "POSTGRES_USER=minintapp", "-e", "POSTGRES_PASSWORD=runtime-smoke-fixture", "-e", "POSTGRES_DB=minintapp_test", "-p", "127.0.0.1::5432", "postgres:17-alpine");
  const pgState = JSON.parse(docker("inspect", postgres))[0];
  process.env.DATABASE_URL = `postgresql://minintapp:runtime-smoke-fixture@127.0.0.1:${pgState.NetworkSettings.Ports["5432/tcp"][0].HostPort}/minintapp_test`;
  process.env.WORKER_TOKEN = token;
  process.env.RUNTIME_POSTGRES_URL = `postgresql://${postgres}:5432`;
  database = await import("./app-database");
  adminPool = (await import("./store")).pool;
  let pgReady = false;
  for (let n=0;n<40;n++) { try { await adminPool.query("SELECT 1"); pgReady=true; break; } catch {} await new Promise(resolve=>setTimeout(resolve,500)); }
  assert(pgReady, "PostgreSQL startup failed");
  await database.secureAppDatabaseCluster();
  for (let index = 0; index < 2; index++) {
    const resource = `${prefix}-${index}`;
    const seed = { id: ids[index], spec: composeSpec(), prompt: "PostgreSQL smoke", ownerId: "test", hostTokenHash: createHash("sha256").update(token).digest("hex"), createdAt: Date.now(), expiresAt: Date.now() + 600000 };
    docker("network", "create", resource);
    docker("network", "connect", resource, postgres);
    await database.ensureAppDatabase(seed);
    docker("run", "-d", "--name", resource, "--network", resource, "--memory", "512m", "--cpus", "0.5", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges:true", "--tmpfs", "/tmp:rw,size=64m", "-p", "127.0.0.1::3000", "-e", `DATABASE_URL=${database.appDatabaseURL(ids[index], true)}`, "-e", "PLATFORM_ROLE=runtime", "-e", `RUNTIME_APP_ID=${ids[index]}`, "-e", `RUNTIME_SEED=${Buffer.from(JSON.stringify(seed)).toString("base64")}`, "-e", `RUNTIME_TOKEN=${token}`, "-e", `APP_ORIGIN=https://${ids[index]}.example.test`, image);
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
  assert(restored, "PostgreSQL data did not survive restart");
  docker("stop", `${prefix}-0`);
  assert.equal((await api(1, `/api/apps/${ids[1]}/state`)).status, 200);
  console.log("Container smoke passed: dedicated PostgreSQL databases/roles, restart persistence, app ID isolation, private RPC, creation disabled, independent stop.");
} finally {
  if (adminPool) await adminPool.end();
  try { docker("rm", "-f", postgres); } catch {}
  for (let index = 0; index < 2; index++) {
    const resource = `${prefix}-${index}`;
    for (const args of [["rm", "-f", resource], ["network", "rm", resource]]) {
      try { docker(...args); } catch { /* Only remove resources created by this test invocation. */ }
    }
  }
}
