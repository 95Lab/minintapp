import { beforeAll, afterAll, expect, it, vi } from "vitest";
vi.hoisted(() => {
  process.env.DATABASE_URL = process.env.PLATFORM_TEST_DATABASE_URL || "postgresql://minintapp:local-integration-only@127.0.0.1:15439/minintapp_test";
  if (new URL(process.env.DATABASE_URL).pathname !== "/minintapp_test") throw new Error("Test database required");
  process.env.WORKER_TOKEN = "integration-test-worker-token";
});
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { pool } from "../../platform/store";
import { ensureAppDatabase, dropAppDatabase, appDatabaseURL, secureAppDatabaseCluster } from "../../platform/app-database";
import { PostgresAppRepository } from "@/lib/runtime-plane/postgres-apps-repository";
import { composeSpec } from "@/lib/app-spec/app-spec-examples";
const ids = [randomBytes(12).toString("hex"), randomBytes(12).toString("hex")];
const clients: Pool[] = [];
const repositories: PostgresAppRepository[] = [];
beforeAll(async () => {
  await secureAppDatabaseCluster();
  for (const id of ids) {
    await ensureAppDatabase({ id, spec: composeSpec(), prompt: "PG test", ownerId: null, parentId: null, hostTokenHash: "a".repeat(64), createdAt: Date.now(), expiresAt: Date.now()+600000 });
    const client = new Pool({ connectionString: appDatabaseURL(id), max: 3 }); clients.push(client);
    repositories.push(new PostgresAppRepository(client, id));
  }
});
afterAll(async () => { for (const client of clients) await client.end(); for (const id of ids) await dropAppDatabase(id); await pool.end(); });
it("uses distinct restricted roles and denies cross-app and metadata access", async () => {
  const roles = await Promise.all(clients.map(async client => (await client.query("SELECT current_user AS name")).rows[0].name));
  expect(new Set(roles).size).toBe(2);
  for (const target of [`app_${ids[1]}`, "minintapp_test", "postgres", "template1"]) {
    const url = new URL(appDatabaseURL(ids[0])); url.pathname = `/${target}`;
    const forbidden = new Pool({ connectionString: url.toString() });
    try { await expect(forbidden.query("SELECT 1")).rejects.toMatchObject({ code: "42501" }); } finally { await forbidden.end(); }
  }
  await expect(clients[0].query("CREATE TABLE forbidden(id int)")).rejects.toMatchObject({ code: "42501" });
  await expect(clients[0].query("SET ROLE minintapp")).rejects.toMatchObject({ code: "42501" });
  await expect(clients[0].query("SELECT pg_read_file('/etc/passwd')")).rejects.toMatchObject({ code: "42501" });
  expect(await repositories[0].snapshot(ids[1])).toBeNull();
});
it("serializes concurrent processes without losing writes and persists after reconnect", async () => {
  const second = new PostgresAppRepository(clients[0], ids[0]);
  await Promise.all(Array.from({ length: 16 }, (_, n) => (n%2 ? second : repositories[0]).mutateSnapshot(ids[0], snapshot => {
    snapshot.app.announcement = { text: String(Number(snapshot.app.announcement?.text || 0)+1), at: Date.now() };
    return { value: true, changed: true };
  })));
  const fresh = new Pool({ connectionString: appDatabaseURL(ids[0]) });
  try { expect((await new PostgresAppRepository(fresh, ids[0]).snapshot(ids[0]))?.app.announcement?.text).toBe("16"); } finally { await fresh.end(); }
  expect((await repositories[1].snapshot(ids[1]))?.app.announcement).toBeNull();
});
it("rolls back late updates, rejects stale CAS and immutable identity changes", async () => {
  const before = (await repositories[0].snapshot(ids[0]))!;
  await expect(repositories[0].mutateSnapshot(ids[0], snapshot => { snapshot.app.prompt="late"; return { value: true, changed: true, deadline: Date.now()-1000 }; })).rejects.toMatchObject({ code: "question_closed" });
  expect((await repositories[0].snapshot(ids[0]))?.app.prompt).toBe(before.app.prompt);
  expect(await repositories[0].compareAndSwap(ids[0], before.app.stateVersion-1, before)).toBe(false);
  const forged = structuredClone(before); forged.app.hostTokenHash = "b".repeat(64);
  await expect(repositories[0].compareAndSwap(ids[0], before.app.stateVersion, forged)).rejects.toMatchObject({ code: "forbidden" });
});
it("reprovisioning keeps the existing snapshot and does not reset answers", async () => {
  const before = (await repositories[0].snapshot(ids[0]))!;
  await ensureAppDatabase({ ...before.app, spec: before.app.spec, hostTokenHash: before.app.hostTokenHash, parentId: null });
  expect(await repositories[0].snapshot(ids[0])).toEqual(before);
});
