import { readFile } from "node:fs/promises";
import { beforeAll, beforeEach, afterAll, afterEach, expect, it, vi } from "vitest";
vi.hoisted(() => {
  process.env.DATABASE_URL = process.env.PLATFORM_TEST_DATABASE_URL || "postgresql://minintapp:local-integration-only@127.0.0.1:15439/minintapp_test";
  if (new URL(process.env.DATABASE_URL).pathname !== "/minintapp_test") throw new Error("Integration tests require minintapp_test database");
  process.env.RUNTIME_IMAGE = `ghcr.io/95lab/minintapp@sha256:${"a".repeat(64)}`;
  process.env.APPS_DOMAIN = "apps.example.test";
  process.env.MAX_ACTIVE_APPS = "3";
});
import { Queue, Worker } from "bullmq";
import { pool, reserveWorker } from "../../platform/store";
import { dispatchOutbox } from "../../platform/scheduler";
import { redisConnection } from "../../platform/contracts";
import { submitDeployment } from "@/lib/control-plane/deployments";
import { composeSpec } from "@/lib/app-spec/app-spec-examples";
import { POST as createRoute } from "@/app/api/apps/from-template/route";
import { GET as deploymentRoute } from "@/app/api/apps/[id]/deployment/route";
import { GET as listRoute } from "@/app/api/my-apps/route";
const connection = redisConnection(process.env.PLATFORM_TEST_REDIS_URL || "redis://127.0.0.1:16389/15");
const queue = new Queue("minintapp-integration", { connection });
beforeAll(async () => {
  expect((await pool.query("SELECT current_database() AS name")).rows[0].name).toBe("minintapp_test");
  await pool.query(await readFile("platform/schema.sql", "utf8"));
});
beforeEach(async () => { await pool.query("TRUNCATE artifacts,deployments,workers CASCADE"); await queue.obliterate({ force: true }); });
afterEach(() => vi.unstubAllEnvs());
afterAll(async () => { await queue.obliterate({ force: true }); await queue.close(); await pool.end(); });
const create = (owner = "owner") => submitDeployment({ spec: composeSpec(), prompt: "vote", lifetime: "1h" }, owner);
it("reserves capacity atomically when schedulers race", async () => {
  await pool.query("INSERT INTO workers(id,agent_url,capacity) VALUES('worker','http://127.0.0.1:19090',1)");
  await pool.query("UPDATE workers SET available_images=ARRAY[$1]", [process.env.RUNTIME_IMAGE]);
  const [a, b] = await Promise.all([create("a"), create("b")]);
  const results = await Promise.allSettled([reserveWorker(a.id), reserveWorker(b.id)]);
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect((await pool.query("SELECT count(*)::int AS count FROM deployments WHERE worker_id='worker'")).rows[0].count).toBe(1);
});
it("does not assign apps to stale workers", async () => {
  await pool.query("INSERT INTO workers(id,agent_url,capacity,heartbeat_at) VALUES('stale','http://127.0.0.1:19090',3,now()-interval '1 minute')");
  await pool.query("UPDATE workers SET available_images=ARRAY[$1]", [process.env.RUNTIME_IMAGE]);
  const app = await create();
  await expect(reserveWorker(app.id)).rejects.toThrow("capacity");
});
it("keeps the outbox after queue failure, then retries once without duplicate jobs", async () => {
  await pool.query("INSERT INTO workers(id,agent_url,capacity) VALUES('worker','http://127.0.0.1:19090',3)");
  await pool.query("UPDATE workers SET available_images=ARRAY[$1]", [process.env.RUNTIME_IMAGE]);
  const app = await create();
  await dispatchOutbox(() => ({ add: async () => { throw new Error("Redis unavailable"); } }));
  expect((await pool.query("SELECT queued_at FROM deployments WHERE id=$1", [app.id])).rows[0].queued_at).toBeNull();
  await dispatchOutbox(() => queue);
  // Simulate a crash after queue.add and before the outbox acknowledgement.
  await pool.query("UPDATE deployments SET queued_at=NULL WHERE id=$1", [app.id]);
  await dispatchOutbox(() => queue);
  expect(await queue.getWaitingCount()).toBe(1);
  let handled = 0;
  const worker = new Worker(queue.name, async () => { handled++; }, { connection });
  await vi.waitFor(() => expect(handled).toBe(1), { timeout: 10000 });
  await worker.close();
});
it("enforces tenant and global quotas transactionally", async () => {
  await Promise.all([create(), create()]);
  await expect(create()).rejects.toThrow("rate_limited");
  await create("other");
  await expect(create("third")).rejects.toThrow("rate_limited");
});
it("replays the same creation request without allocating a second app or host token", async () => {
  const input = { spec: composeSpec(), prompt: "vote", lifetime: "1h" as const };
  const options = { requestKey: "retry-1", ownerSecret: "test-owner-secret" };
  const first = await submitDeployment(input, "owner", options);
  const retry = await submitDeployment(input, "owner", options);
  expect(retry).toEqual(first);
  expect((await pool.query("SELECT count(*)::int AS count FROM deployments")).rows[0].count).toBe(1);
  await expect(submitDeployment({ ...input, prompt: "changed" }, "owner", options)).rejects.toThrow("invalid_request");
});
it("returns 202 with scoped host cookies and exposes deployment state only to its owner", async () => {
  vi.stubEnv("PLATFORM_ROLE", "control"); vi.stubEnv("REDIS_URL", "redis://127.0.0.1:16389/15");
  vi.stubEnv("WORKER_TOKEN", "test-worker-token"); vi.stubEnv("WORKER_AGENT_URLS", "http://127.0.0.1:19090");
  const request = new Request("http://local/api/apps/from-template", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ templateId: "poll-drinks" }) });
  const response = await createRoute(request);
  expect(response.status).toBe(202);
  const created = await response.json();
  const cookies = response.headers.get("set-cookie")!;
  expect(cookies).toContain(`Path=/api/apps/${created.id}`);
  expect(cookies).toContain("HttpOnly");
  const context = { params: Promise.resolve({ id: created.id }) };
  expect((await deploymentRoute(new Request("http://local"), context)).status).toBe(403);
  const state = await deploymentRoute(new Request("http://local", { headers: { "x-host-token": created.hostToken } }), context);
  const statusBody = await state.json();
  expect(statusBody.state).toBe("QUEUED");
  const tenantCookie = /minint_tenant=([a-f0-9]{64})/.exec(cookies)![0];
  const owned = await listRoute(new Request("http://local", { headers: { cookie: tenantCookie } }));
  expect((await owned.json()).apps).toHaveLength(1);
  const stranger = await listRoute(new Request("http://local"));
  expect((await stranger.json()).apps).toHaveLength(0);
  expect(JSON.stringify(statusBody).includes("host_token_hash")).toBe(false);
});
