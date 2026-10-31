import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { SupabaseAppsRepository, supabaseRpc, type SupabaseRpc } from "@/lib/db/supabase-apps-repository";
import { composeSpec } from "@/lib/app-spec/app-spec-examples";
import { composeTemplate } from "@/lib/templates/compose-templates";
import { verifyToken } from "@/lib/security/token-hashing";
let db: PGlite;
const call: SupabaseRpc = async (name, args) => db.transaction(async (tx) => {
  await tx.exec("set local role service_role");
  const query = name === "minint_commit" ? "select public.minint_commit($1,$2,$3::jsonb,$4) as value" : "select public.minint_snapshot($1) as value";
  const params = name === "minint_commit" ? [args.p_id, args.p_expected_version, JSON.stringify(args.p_document), args.p_deadline_ms] : [args.p_id];
  return (await tx.query<{ value: unknown }>(query, params)).rows[0].value;
});
const newRepo = () => new SupabaseAppsRepository(call);
const vote = (person: string, choice = "tea") => ({ blockId: "poll", itemId: "", participantHash: person, displayName: null, payload: { kind: "compose" as const, values: { drink: choice } } });
const create = () => newRepo().createApp({ spec: composeSpec(), prompt: "poll", lifetimeMs: 3600000 });
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema realtime; create table realtime.test_messages(payload jsonb, event text, topic text, private boolean);
    create function realtime.send(payload jsonb,event text,topic text,private boolean default true) returns void
    language sql security definer as $$ insert into realtime.test_messages values(payload,event,topic,private) $$;
    grant usage on schema realtime to service_role;`);
  // Execute the actual migration; only Supabase's delivery function is replaced locally.
  await db.exec(readFileSync("supabase/migrations/202610310001_supabase_storage.sql", "utf8"));
}, 30000);
afterAll(async () => { await db?.close(); });
describe("Supabase repository on embedded PostgreSQL", () => {
  it("persists snapshots across repository instances and publishes only invalidations", async () => {
    const { app, hostToken } = await create();
    expect(verifyToken(hostToken, app.hostTokenHash)).toBe(true);
    expect(app.realtimeChannel).toMatch(/^[a-f0-9]{64}$/);
    await newRepo().submitResponse(app.id, vote("private-participant-hash"));
    const snapshot = await newRepo().snapshot(app.id);
    expect(snapshot?.responses).toHaveLength(1); expect(snapshot?.app.stateVersion).toBe(2);
    const { rows } = await db.query<{ payload: unknown; topic: string; private: boolean }>("select * from realtime.test_messages where topic = $1", [`app:${app.realtimeChannel}`]);
    expect(rows).toHaveLength(1); expect(rows[0].payload).toEqual({ version: 2 }); expect(rows[0].private).toBe(false);
    expect(JSON.stringify(rows)).not.toMatch(/private-participant-hash|hostTokenHash|drink/);
  });
  it("rebases concurrent writes from different app servers without losing answers", async () => {
    const { app } = await create();
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => newRepo().submitResponse(app.id, vote(`person-${i}`))));
    expect(results).toEqual(Array(10).fill("ok"));
    expect((await newRepo().snapshot(app.id))?.app.stateVersion).toBe(11);
    expect(await newRepo().listResponses(app.id)).toHaveLength(10);
    await newRepo().submitResponse(app.id, vote("person-1", "coffee"));
    expect(await newRepo().listResponses(app.id)).toHaveLength(10);
  });
  it("rechecks lifecycle after a conflicting write and does not accept an old active snapshot", async () => {
    const { app, hostToken } = await create(); let closed = false;
    const racing: SupabaseRpc = async (name, args, signal) => {
      if (name === "minint_commit" && !closed) { closed = true; await newRepo().transition(app.id, hostToken, "close"); }
      return call(name, args, signal);
    };
    expect(await new SupabaseAppsRepository(racing).submitResponse(app.id, vote("late"))).toBe("closed");
    expect(await newRepo().listResponses(app.id)).toHaveLength(0);
    await expect(newRepo().transition(app.id, "wrong-token", "reopen")).rejects.toMatchObject({ code: "forbidden" });
    await newRepo().transition(app.id, hostToken, "reopen"); await newRepo().submitResponse(app.id, vote("accepted"));
    await newRepo().transition(app.id, hostToken, "end");
    expect(await newRepo().listResponses(app.id)).toHaveLength(0);
    expect(await newRepo().submitResponse(app.id, vote("late"))).toBe("gone");
  });
  it.each(["anon", "authenticated"])("denies %s access to snapshots and RPCs", async (role) => {
    for (const query of ["select * from public.minint_app_snapshots", "select public.minint_snapshot('aaaaaaaaaaaaaaaaaaaaaaaa')", "select public.minint_storage_health()", "select public.minint_commit('aaaaaaaaaaaaaaaaaaaaaaaa',0,'{}'::jsonb,null)"]) {
      await expect(db.transaction(async (tx) => { await tx.exec(`set local role ${role}`); await tx.exec(query); })).rejects.toThrow(/permission denied/);
    }
  });
  it("enforces response limits and slot capacity after concurrent commits", async () => {
    const s = composeSpec(); const b = s.blocks[0]; if (b.type !== "compose") throw Error();
    b.inputs[0].kind = "slot"; b.inputs[0].capacity = 1;
    const { app } = await newRepo().createApp({ spec: s, prompt: "slot", lifetimeMs: 3600000 });
    const results = await Promise.allSettled([newRepo().submitResponse(app.id, vote("one")), newRepo().submitResponse(app.id, vote("two"))]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await newRepo().listResponses(app.id)).toHaveLength(1);
  });
  it("rejects expired and late step writes at the transaction boundary", async () => {
    const { app } = await create(); const current = (await newRepo().snapshot(app.id))!;
    current.app.stateVersion++;
    expect(await call("minint_commit", { p_id: app.id, p_expected_version: 1, p_document: current, p_deadline_ms: Date.now() - 1000 }, AbortSignal.timeout(5000))).toBe("question_closed");
    await db.query("update public.minint_app_snapshots set expires_at = now() - interval '1 second' where id = $1", [app.id]);
    expect(await newRepo().submitResponse(app.id, vote("late"))).toBe("gone");
  });
  it("applies compose steps using the database timestamp", async () => {
    const { app, hostToken } = await newRepo().createApp({ spec: composeTemplate("compose-steps", "vi")!, prompt: "steps", lifetimeMs: 3600000 });
    await newRepo().blockAction(app.id, hostToken, { blockId: "form", action: "next" });
    expect((await newRepo().findApp(app.id))?.runtime.blocks.form.step?.current).toBe("content");
    expect(await newRepo().submitResponse(app.id, { blockId: "form", itemId: "content", participantHash: "p", displayName: "Lan", payload: { kind: "compose", values: { content: 4 } } })).toBe("ok");
    await newRepo().blockAction(app.id, hostToken, { blockId: "form", action: "close" });
    await expect(newRepo().submitResponse(app.id, { blockId: "form", itemId: "content", participantHash: "p", displayName: "Lan", payload: { kind: "compose", values: { content: 4 } } })).rejects.toMatchObject({ code: "question_closed" });
  });
});
it("does not retry or leak storage errors on an uncertain network failure", async () => {
  const fetcher = vi.fn(async () => new Response("service-role-secret database failure", { status: 500 }));
  const rpc = supabaseRpc("https://example.supabase.co", "service-role-secret", fetcher);
  await expect(rpc("minint_commit", {}, AbortSignal.timeout(1000))).rejects.toMatchObject({ code: "storage_unavailable", message: "storage_unavailable" });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("sends new secret keys only in apikey, not as a JWT bearer", async () => {
  const fetcher = vi.fn<typeof fetch>(async () => Response.json(1));
  await supabaseRpc("https://example.supabase.co", "sb_secret_private", fetcher)("minint_storage_health", {}, AbortSignal.timeout(1000));
  expect(fetcher.mock.calls[0][1]?.headers).toEqual({ apikey: "sb_secret_private", "Content-Type": "application/json" });
});
