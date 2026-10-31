import { readFile } from "node:fs/promises";
import { beforeAll, beforeEach, afterAll, afterEach, expect, it, vi } from "vitest";
vi.hoisted(() => {
  process.env.DATABASE_URL = process.env.PLATFORM_TEST_DATABASE_URL || "postgresql://minintapp:local-integration-only@127.0.0.1:15439/minintapp_test";
  if (new URL(process.env.DATABASE_URL).pathname !== "/minintapp_test") throw new Error("Integration tests require minintapp_test database");
  process.env.RUNTIME_IMAGE = `ghcr.io/95lab/minintapp@sha256:${"a".repeat(64)}`;
  process.env.APPS_DOMAIN = "apps.example.test";
  process.env.MAX_ACTIVE_APPS = "3";
});
import { manageDeployment, ensureInitialRelease, completeRelease, release } from "../../platform/release-store";
import { Queue, Worker } from "bullmq";
import { pool, reserveWorker } from "../../platform/store";
import { dispatchOutbox } from "../../platform/scheduler";
import { redisConnection } from "../../platform/contracts";
import { submitDeployment } from "@/lib/control-plane/deployments";
import { composeSpec } from "@/lib/app-spec/app-spec-examples";
import { POST as createRoute } from "@/app/api/apps/from-template/route";
import { GET as deploymentRoute } from "@/app/api/apps/[id]/deployment/route";
import { GET as listRoute } from "@/app/api/my-apps/route";
import { createSessionValue, SESSION_COOKIE } from "@/engine/auth/host-session";
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
  await expect(create()).rejects.toThrow("owner_app_limit");
  await create("other");
  await expect(create("third")).rejects.toThrow("app_capacity_full");
});
it("releases tenant and global quota when a deployment fails", async () => {
  const [failed] = await Promise.all([create(), create(), create("other")]);
  await expect(create()).rejects.toThrow("app_capacity_full");
  await pool.query("UPDATE deployments SET state='FAILED' WHERE id=$1", [failed.id]);
  await expect(create()).resolves.toBeTruthy();
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
  const sessionCookie = `${SESSION_COOKIE}=${createSessionValue({ userId: "11111111-1111-4111-8111-111111111111", email: "owner@example.test" })}`;
  const owned = await listRoute(new Request("http://local", { headers: { cookie: `${tenantCookie}; ${sessionCookie}` } }));
  expect(owned.status).toBe(200);
  expect((await owned.json()).apps).toHaveLength(1);
  const strangerCookie = `${SESSION_COOKIE}=${createSessionValue({ userId: "22222222-2222-4222-8222-222222222222", email: "stranger@example.test" })}`;
  const stranger = await listRoute(new Request("http://local", { headers: { cookie: strangerCookie } }));
  expect(stranger.status).toBe(200);
  expect((await stranger.json()).apps).toHaveLength(0);
  for (const cookie of ["", tenantCookie]) {
    const anonymous = await listRoute(new Request("http://local", { headers: { cookie } }));
    expect(anonymous.status).toBe(401);
    expect(await anonymous.json()).toEqual({ code: "sign_in_required" });
  }
  expect(JSON.stringify(statusBody).includes("host_token_hash")).toBe(false);
});

it("serializes competing release requests and refuses stale promotion against real PostgreSQL", async () => {
  const firstImage = process.env.RUNTIME_IMAGE!;
  const secondImage = `ghcr.io/95lab/minintapp@sha256:${"b".repeat(64)}`;
  await pool.query("INSERT INTO workers(id,agent_url,capacity,available_images) VALUES('release-worker','http://127.0.0.1:19090',3,$1)", [[firstImage,secondImage]]);
  const created = await create();
  const seed = { id:created.id,spec:composeSpec(),prompt:"vote",ownerId:"owner",hostTokenHash:"c".repeat(64),createdAt:Date.now(),expiresAt:Date.now()+60000 };
  await pool.query("UPDATE deployments SET seed=$2,state='RUNNING',worker_id='release-worker',active_version=1 WHERE id=$1",[created.id,seed]);
  await ensureInitialRelease({id:created.id,image:firstImage,seed} as import("../../platform/contracts").Deployment);
  await pool.query("UPDATE app_releases SET status='SUCCEEDED' WHERE app_id=$1",[created.id]);
  const results = await Promise.allSettled([1,2].map(() => manageDeployment(created.id,{action:"deploy",image:secondImage,expectedVersion:1})));
  expect(results.filter(value=>value.status==='fulfilled')).toHaveLength(1);
  const app = (await pool.query<import("../../platform/contracts").Deployment>("SELECT * FROM deployments WHERE id=$1",[created.id])).rows[0];
  expect(app).toMatchObject({active_version:1,requested_version:2,revision:2});
  await pool.query("UPDATE deployments SET state='DEPLOYING' WHERE id=$1",[created.id]);
  await expect(completeRelease({...app,revision:1},(await release(created.id,2))!)).rejects.toThrow("current");
  await completeRelease(app,(await release(created.id,2))!);
  expect((await pool.query("SELECT active_version,image FROM deployments WHERE id=$1",[created.id])).rows[0]).toEqual({active_version:2,image:secondImage});
});
