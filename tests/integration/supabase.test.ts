import { createClient } from "@supabase/supabase-js";
import { expect, it } from "vitest";
import { readRuntimeConfig } from "@/lib/config/runtime-config";
import { SupabaseAppsRepository, supabaseRpc } from "@/lib/db/supabase-apps-repository";
import { composeSpec } from "@/lib/app-spec/app-spec-examples";
import { readAppState } from "@/lib/api/poll-service";
it("persists across adapters and delivers database invalidations through real Supabase Realtime", async () => {
  const env = readRuntimeConfig();
  if (env.APP_STORAGE !== "supabase") throw new Error("Set APP_STORAGE=supabase before running the live integration test.");
  const makeRepo = () => new SupabaseAppsRepository(supabaseRpc(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY));
  const repo = makeRepo();
  const { app, hostToken } = await repo.createApp({ spec: composeSpec(), prompt: "Supabase integration check", lifetimeMs: 3600000 });
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const versions = new Set<number>();
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Realtime did not subscribe.")), 10000);
      client.channel(`app:${app.realtimeChannel}`, { config: { private: false } })
        .on("broadcast", { event: "state_changed" }, ({ payload }) => { if (typeof payload?.version === "number") versions.add(payload.version); })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") { clearTimeout(timer); resolve(); }
          else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") { clearTimeout(timer); reject(new Error("Realtime connection failed.")); }
        });
    });
    const row = (who: string) => ({ blockId: "poll", itemId: "", participantHash: who, displayName: null, payload: { kind: "compose" as const, values: { drink: "tea" } } });
    const results = await Promise.all([repo.submitResponse(app.id, row("integration-one")), makeRepo().submitResponse(app.id, row("integration-two"))]);
    expect(results).toEqual(["ok", "ok"]);
    const persisted = await makeRepo().snapshot(app.id);
    expect(persisted?.app.stateVersion).toBe(3); expect(persisted?.responses).toHaveLength(2);
    await expect.poll(() => versions.has(3), { timeout: 10000 }).toBe(true);
    const state = await readAppState(new Request("http://local"), app.id);
    expect(state.sync?.mode).toBe("supabase"); expect(state.participantCount).toBe(2);
    expect(JSON.stringify(state)).not.toMatch(/hostTokenHash|integration-one|integration-two/);
    await repo.transition(app.id, hostToken, "close");
    expect(await makeRepo().submitResponse(app.id, row("integration-late"))).toBe("closed");
  } finally {
    try { await repo.transition(app.id, hostToken, "end"); }
    finally { await client.removeAllChannels(); }
  }
});
