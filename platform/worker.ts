import "./worker-credentials";
import { createServer } from "node:http";
import { runtimeHealth as health } from "./runtime-health";
import { createHash, timingSafeEqual } from "node:crypto";
import { Queue, Worker, UnrecoverableError } from "bullmq";
import { putArtifact, removeArtifacts, ensureArtifactBucket } from "./artifacts";
import { syncGateway } from "./gateway-sync";
import { backupApp } from "./backup";
import { dispatchOutbox } from "./scheduler";
import { withAppLock } from "./locks";
import { pool, deployment, updateState, migrate } from "./store";
import { RuntimeSeedSchema, redisConnection } from "./contracts";
import { provision, reclaim, runtimeToken, cachedImages } from "./docker-runtime";
import { publishRoute, unpublishRoute } from "./gateway";
import { CloudflareDNS } from "./cloudflare";
import { buildSpec } from "./build-spec";
import { AppError } from "../src/lib/api/app-error-codes";

for (const key of ["DATABASE_URL", "REDIS_URL", "WORKER_ID", "WORKER_TOKEN", "WORKER_AGENT_URL", "CLOUDFLARE_ZONE_ID", "CLOUDFLARE_API_TOKEN", "INGRESS_HOSTNAME", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"]) {
  if (!process.env[key]) throw new Error(`Missing ${key}`);
}
const workerId = process.env.WORKER_ID!;
if (!/^[a-z0-9-]{1,40}$/.test(workerId)) throw new Error("Invalid worker ID");
const agentURL = new URL(process.env.WORKER_AGENT_URL!);
const capacity = Number(process.env.WORKER_CAPACITY || 3);
if (!Number.isInteger(capacity) || capacity < 1 || capacity > 20) throw new Error("Invalid capacity");
const connection = redisConnection(process.env.REDIS_URL!);
const dns = new CloudflareDNS(process.env.CLOUDFLARE_ZONE_ID!, process.env.CLOUDFLARE_API_TOKEN!, process.env.INGRESS_HOSTNAME!, fetch, process.env.DNS_AUTOMATION_APPROVED === "true");
const queues = new Map<string, Queue>();
function queue(id: string) {
  if (!queues.has(id)) queues.set(id, new Queue(`minintapp-${id}`, { connection }));
  return queues.get(id)!;
}
await migrate();
await ensureArtifactBucket();
await pool.query(`INSERT INTO workers(id,agent_url,capacity,gateway_url,available_images) VALUES($1,$2,$3,$4,$5)
  ON CONFLICT(id) DO UPDATE SET agent_url=excluded.agent_url,capacity=excluded.capacity,gateway_url=excluded.gateway_url,available_images=excluded.available_images,heartbeat_at=now()`, [workerId, agentURL.origin, capacity, process.env.WORKER_GATEWAY_URL || null, await cachedImages()]);

async function cleanup(id: string, destroyData = false) {
  const record = await deployment(id);
  if (!record || record.worker_id !== workerId) throw new Error("Worker ownership mismatch");
  await unpublishRoute(id);
  await reclaim(id, destroyData);
  if (record.dns_record_id) { await dns.remove(record.dns_record_id, id); await pool.query("UPDATE deployments SET dns_record_id=NULL WHERE id=$1", [id]); }
  if (destroyData) await removeArtifacts(id);
}
const worker = new Worker(`minintapp-${workerId}`, async (job) => withAppLock(job.data.id, async () => {
  let app = await deployment(job.data.id);
  if (!app || app.worker_id !== workerId) throw new Error("Worker ownership mismatch");
  if (app.expires_at.getTime() <= Date.now()) { await cleanup(app.id); await updateState(app.id, "EXPIRED"); return; }
  let phase = "generation";
  try {
    if (!app.seed) {
      await updateState(app.id, "GENERATING");
      const result = await buildSpec(app.input);
      const validated = { spec: result.spec };
      const seed = RuntimeSeedSchema.parse({ id: app.id, spec: validated.spec, prompt: app.input.prompt, hostTokenHash: app.host_token_hash,
        createdAt: app.created_at.getTime(), expiresAt: app.expires_at.getTime(), ownerId: app.input.ownerId || null, parentId: app.input.parentId || null });
      await pool.query("UPDATE deployments SET seed=$2,generation=$3,state='BUILDING',updated_at=now() WHERE id=$1", [app.id, seed, result.generation]);
      const digest = createHash("sha256").update(JSON.stringify(seed)).digest("hex");
      await pool.query("INSERT INTO artifacts(app_id,version,spec_digest,image) VALUES($1,1,$2,$3) ON CONFLICT DO NOTHING", [app.id, digest, app.image]);
      app = (await deployment(app.id))!;
    }
    phase = "artifact";
    await putArtifact(RuntimeSeedSchema.parse(app.seed), app.image);
    await updateState(app.id, "DEPLOYING");
    phase = "provision";
    const port = await provision(app);
    await pool.query("UPDATE deployments SET port=$2 WHERE id=$1", [app.id, port]);
    phase = "runtime-health";
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      try { await health(`http://127.0.0.1:${port}/api/health`, app.id); ready = true; break; } catch { await new Promise((resolve) => setTimeout(resolve, 1000)); }
    }
    if (!ready) throw new Error("Runtime startup timeout");
    phase = "gateway-route";
    await publishRoute(app.id, app.hostname, port);
    if (process.env.INGRESS_HOSTNAME !== "ingress.minintapp.io.vn" || app.hostname !== `${app.id}.minintapp.io.vn`) throw new Error("DNS outside approved demo scope");
    phase = "dns";
    const dnsId = await dns.ensure(app.hostname, app.id);
    await pool.query("UPDATE deployments SET dns_record_id=$2 WHERE id=$1", [app.id, dnsId]);
    await new Promise((resolve) => setTimeout(resolve, 2500));
    phase = "gateway-health";
    await health(`${process.env.LOCAL_GATEWAY_URL || "http://127.0.0.1:18081"}/api/health`, app.id, { Host: app.hostname });
    phase = "public-health";
    await health(`https://${app.hostname}/api/health`, app.id);
    await updateState(app.id, "RUNNING");
  } catch (error) {
    console.error(JSON.stringify({ event: "deployment_phase_failed", id: app.id, phase }));
    const permanent = error instanceof AppError && ["ai_refused", "ai_invalid_output", "invalid_request", "ai_not_configured"].includes(error.code);
    if (permanent || job.attemptsMade + 1 >= (job.opts.attempts || 1)) {
      try { await cleanup(app.id); }
      finally { await updateState(app.id, "FAILED"); }
    }
    if (permanent) throw new UnrecoverableError("Generation rejected or not configured");
    throw new Error("Provisioning failed");
  }
}), { connection, concurrency: 1 });
worker.on("error", () => console.error("Worker connection error"));
worker.on("failed", (job) => console.error(JSON.stringify({ event: "deployment_failed", id: job?.data.id, attempt: job?.attemptsMade })));

let ticking = false;
const lastBackup = new Map<string, number>();
async function tick() {
  if (ticking) return;
  ticking = true;
  try {
    await pool.query("UPDATE workers SET heartbeat_at=now() WHERE id=$1", [workerId]);
    await dispatchOutbox(queue);
    await pool.query("UPDATE deployments SET state='EXPIRED' WHERE worker_id IS NULL AND expires_at<=now() AND state='QUEUED'");
    const stopped = await pool.query<{ id: string }>("SELECT id FROM deployments WHERE worker_id=$1 AND state IN ('SUSPENDED','FAILED')", [workerId]);
    for (const row of stopped.rows) await withAppLock(row.id, async () => { if (["SUSPENDED", "FAILED"].includes((await deployment(row.id))?.state || "")) await cleanup(row.id); });
    const expired = await pool.query<{ id: string }>("SELECT id FROM deployments WHERE worker_id=$1 AND state NOT IN ('EXPIRED','DELETED') AND expires_at<=now()", [workerId]);
    for (const row of expired.rows) await withAppLock(row.id, async () => { await cleanup(row.id); await updateState(row.id, "EXPIRED"); });
    const running = await pool.query<{ id: string }>("SELECT id FROM deployments WHERE worker_id=$1 AND state='RUNNING'", [workerId]);
    for (const row of running.rows) if (Date.now() - (lastBackup.get(row.id) || 0) > 300000) {
      await withAppLock(row.id, async () => { await backupApp(row.id); lastBackup.set(row.id, Date.now()); });
    }
    const retained = await pool.query<{ id: string }>("SELECT id FROM deployments WHERE worker_id=$1 AND state='EXPIRED' AND expires_at<now()-interval '24 hours'", [workerId]);
    for (const row of retained.rows) await withAppLock(row.id, async () => { await cleanup(row.id, true); await updateState(row.id, "DELETED"); });
  } catch { console.error("Reconciliation failed; will retry"); }
  finally { ticking = false; }
}
const timer = setInterval(tick, 5000);
let heartbeating = false;
const heartbeat = setInterval(async () => {
  if (heartbeating) return;
  heartbeating = true;
  try { await pool.query("UPDATE workers SET heartbeat_at=now(),available_images=$2 WHERE id=$1", [workerId, await cachedImages()]); }
  catch { console.error("Heartbeat failed"); }
  finally { heartbeating = false; }
}, 5000);
let syncing = false;
const gatewayTimer = setInterval(async () => {
  if (process.env.IS_EDGE_WORKER !== "true" || syncing) return;
  syncing = true;
  try { await syncGateway(workerId); } catch { console.error("Gateway sync failed"); }
  finally { syncing = false; }
}, 1000);
await tick();
const server = createServer(async (request, response) => {
  try {
    const token = request.headers.authorization?.replace(/^Bearer /, "") || "";
    if (!timingSafeEqual(createHash("sha256").update(token).digest(), createHash("sha256").update(process.env.WORKER_TOKEN!).digest())) { response.writeHead(403).end(); return; }
    if (request.method === "GET" && request.url === "/health") {
      response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ status: "ok", workerId })); return;
    }
    const backup = /^\/backup\/([a-f0-9]{24})$/.exec(request.url || "");
    if (request.method === "POST" && backup) {
      const owned = await deployment(backup[1]);
      if (!owned || owned.worker_id !== workerId || owned.state !== "RUNNING") { response.writeHead(404).end(); return; }
      await withAppLock(owned.id, () => backupApp(owned.id));
      response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ ok: true })); return;
    }
    const match = /^\/runtime\/([a-f0-9]{24})$/.exec(request.url || "");
    if (request.method !== "POST" || !match) { response.writeHead(404).end(); return; }
    const app = await deployment(match[1]);
    if (!app || app.worker_id !== workerId || !app.port || app.state !== "RUNNING" || app.expires_at.getTime() <= Date.now()) { response.writeHead(410).end(); return; }
    const chunks: Buffer[] = []; let size = 0;
    for await (const chunk of request) { size += chunk.length; if (size > 16 * 1024 * 1024) { response.writeHead(413).end(); return; } chunks.push(chunk); }
    const upstream = await fetch(`http://127.0.0.1:${app.port}/api/internal/runtime`, { method: "POST", headers: { Authorization: `Bearer ${runtimeToken(app.id)}`, "Content-Type": "application/json" }, body: Buffer.concat(chunks), signal: AbortSignal.timeout(8000) });
    response.writeHead(upstream.status, { "Content-Type": "application/json", "Cache-Control": "no-store" }).end(await upstream.text());
  } catch { response.writeHead(503).end(JSON.stringify({ code: "runtime_unavailable" })); }
});
server.requestTimeout = 10000;
await worker.waitUntilReady();
server.listen(Number(agentURL.port), process.env.WORKER_BIND_ADDRESS || "127.0.0.1");
async function shutdown() { clearInterval(timer); clearInterval(heartbeat); clearInterval(gatewayTimer); server.close(); await worker.close(); for (const value of queues.values()) await value.close(); await pool.end(); }
process.on("SIGTERM", () => { void shutdown(); });
process.on("SIGINT", () => { void shutdown(); });
