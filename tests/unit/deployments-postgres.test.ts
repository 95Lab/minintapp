import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { SupabaseDeploymentsRepository } from "@/lib/db/supabase-deployments-repository";
import { supabaseRpc, type SupabaseRpc } from "@/lib/db/supabase-apps-repository";
import type { DeploymentCommand } from "@/lib/deployments/deployment-schema";
import { deploymentImage, deploymentInput } from "../support/deployment-fixtures";
let db: PGlite;
const call: SupabaseRpc = async (name, args) => db.transaction(async tx => {
  await tx.exec("set local role service_role");
  let query: string; let values: unknown[];
  switch (name) {
    case "minint_deployment_create": query = "select public.minint_deployment_create($1::jsonb) as value"; values = [JSON.stringify(args.p_document)]; break;
    case "minint_deployment_commit": query = "select public.minint_deployment_commit($1,$2,$3::jsonb) as value"; values = [args.p_id, args.p_expected_version, JSON.stringify(args.p_document)]; break;
    case "minint_deployment_list": query = "select public.minint_deployment_list($1) as value"; values = [args.p_app_id]; break;
    case "minint_deployment_read": query = "select public.minint_deployment_read($1) as value"; values = [args.p_id]; break;
    default: throw new Error("unexpected_rpc");
  }
  return (await tx.query<{ value: unknown }>(query, values)).rows[0].value;
});
const repo = () => new SupabaseDeploymentsRepository(call);
let serial = 0;
const input = () => deploymentInput({ idempotencyKey: `create-${++serial}`, hostname: `app-${serial}.runtime.example` });
beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
  await db.exec(readFileSync("supabase/migrations/202610310003_deployments.sql", "utf8"));
}, 30000);
afterAll(async () => { await db?.close(); });

describe("deployment repository against real migration in embedded PostgreSQL", () => {
  it("persists across adapter instances, deduplicates races and enforces intent/hostname uniqueness", async () => {
    const intent = input();
    const [a, b] = await Promise.all([repo().create(intent), repo().create(intent)]);
    expect([a.created, b.created].sort()).toEqual([false, true]);
    expect(a.deployment.id).toBe(b.deployment.id);
    expect(await repo().find(a.deployment.id)).toEqual(a.deployment);
    expect((await repo().listByApp(intent.appId)).some(d => d.id === a.deployment.id)).toBe(true);
    await expect(repo().create({ ...intent, specHash: "f".repeat(64) })).rejects.toMatchObject({ code: "idempotency_conflict" });
    await expect(repo().create({ ...intent, idempotencyKey: "another" })).rejects.toMatchObject({ code: "hostname_conflict" });
    expect(await repo().find("f".repeat(24))).toBeNull();
  });
  it("accepts one worker claim, rejects stale updates and requires gateway-ready resources", async () => {
    let r = (await repo().create(input())).deployment;
    const claims = await Promise.allSettled(["vm-1", "vm-2"].map(workerId => repo().command(r.id, r.version, { type: "start", workerId })));
    expect(claims.filter(x => x.status === "fulfilled")).toHaveLength(1);
    expect(claims.find(x => x.status === "rejected")).toMatchObject({ reason: { code: "version_conflict" } });
    r = (await repo().find(r.id))!;
    const step = async (command: DeploymentCommand) => { r = await repo().command(r.id, r.version, command); };
    await step({ type: "build" }); await step({ type: "deploy", imageRef: deploymentImage });
    await step({ type: "resources", volumeId: "data-1" });
    await step({ type: "resources", sandboxId: "sandbox-1", dnsRecordId: "dns-1" });
    await step({ type: "fail", code: "gateway_failed", retryable: true });
    await step({ type: "retry" }); await step({ type: "start", workerId: r.workerId! });
    await step({ type: "build" }); await step({ type: "deploy", imageRef: deploymentImage });
    await step({ type: "ready", verifiedUrl: `https://${r.hostname}/` });
    expect(r).toMatchObject({ state: "RUNNING", job: { status: "SUCCEEDED", attempt: 2 } });
    await step({ type: "suspend" }); await step({ type: "resume", verifiedUrl: `https://${r.hostname}/` });
    expect(r.errors).toHaveLength(1);
    expect((await repo().find(r.id))?.state).toBe("RUNNING");
  });
  it("database rejects skipped stages and immutable identity edits even through direct RPC", async () => {
    const r = (await repo().create(input())).deployment;
    const base = { p_id: r.id, p_expected_version: r.version };
    await expect(call("minint_deployment_commit", { ...base, p_document: { ...r, version: 2, state: "RUNNING" } }, AbortSignal.timeout(5000))).rejects.toThrow(/Invalid deployment transition/);
    await expect(call("minint_deployment_commit", { ...base, p_document: { ...r, version: 2, appId: "e".repeat(24), state: "GENERATING" } }, AbortSignal.timeout(5000))).rejects.toThrow(/Immutable deployment identity/);
  });
  it("expires jobs, retains reservations until cleanup and permits safe idempotency replay after expiry", async () => {
    const intent = input(); const created = await repo().create(intent); const d = created.deployment;
    // Move the DB clock's expiry boundary without waiting. Keep row and document consistent.
    const past = Date.now() - 1000;
    await db.query("update public.minint_deployments set expires_at=to_timestamp($2::double precision/1000), document=document || jsonb_build_object('expiresAt',$2::bigint,'createdAt',$3::bigint,'updatedAt',$3::bigint) where id=$1", [d.id, past, past - 10000]);
    await expect(repo().command(d.id, d.version, { type: "start", workerId: "vm-1" })).rejects.toMatchObject({ code: "expired" });
    const expired = await repo().command(d.id, d.version, { type: "expire" });
    expect(expired.job.status).toBe("CANCELLED");
    await expect(repo().create({ ...intent, idempotencyKey: "replacement" })).rejects.toMatchObject({ code: "hostname_conflict" });
    const deleted = await repo().command(expired.id, expired.version, { type: "delete", cleanupConfirmed: true });
    expect(deleted.state).toBe("DELETED");
    const replay = await repo().create({ ...intent, expiresAt: past }); expect(replay.created).toBe(false); expect(replay.deployment.state).toBe("DELETED");
    expect((await repo().create({ ...intent, idempotencyKey: "replacement" })).created).toBe(true);
  });
  it.each(["anon", "authenticated"])("denies %s table and RPC access", async role => {
    for (const sql of ["select * from public.minint_deployments", "select public.minint_deployment_read('a')", "select public.minint_deployment_list('a')", "select public.minint_deployment_create('{}'::jsonb)", "select public.minint_deployment_commit('a',1,'{}'::jsonb)"]) {
      await expect(db.transaction(async tx => { await tx.exec(`set local role ${role}`); await tx.exec(sql); })).rejects.toThrow(/permission denied/);
    }
  });
});

it("does not retry an uncertain write or expose transport error details", async () => {
  const fetcher = vi.fn<typeof fetch>(async () => new Response("internal database error", { status: 500 }));
  await expect(new SupabaseDeploymentsRepository(supabaseRpc("https://example.supabase.co", "test-key", fetcher)).create(input())).rejects.toMatchObject({ code: "storage_unavailable" });
  expect(fetcher).toHaveBeenCalledTimes(1);
  await expect(new SupabaseDeploymentsRepository(async () => ({ outcome: "created", deployment: {} })).create(input())).rejects.toMatchObject({ code: "storage_unavailable" });
});
