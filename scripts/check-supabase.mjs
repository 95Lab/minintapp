import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { EnvSchema } from "../src/lib/config/env-schema.ts";
const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error(`Invalid environment fields: ${[...new Set(parsed.error.issues.map((i) => i.path.join(".")))].join(", ")}`);
  process.exitCode = 1;
} else if (parsed.data.APP_STORAGE !== "supabase") {
  console.error("Set APP_STORAGE=supabase and configure all four Supabase variables first.");
  process.exitCode = 1;
} else {
  const env = parsed.data;
  const headers = (key) => ({ apikey: key, ...(key.startsWith("sb_") ? {} : { Authorization: `Bearer ${key}` }), "Content-Type": "application/json" });
  const post = (path, key, body) => fetch(`${env.SUPABASE_URL.replace(/\/$/, "")}${path}`, { method: "POST", headers: headers(key), body: JSON.stringify(body), signal: AbortSignal.timeout(8000) });
  try {
    const health = await post("/rest/v1/rpc/minint_storage_health", env.SUPABASE_SERVICE_ROLE_KEY, {});
    if (!health.ok || await health.json() !== 1) throw new Error("Database check failed. Apply the migration and verify the server key.");
    console.log("Database migration and service-role access: OK");
    for (const path of ["/rest/v1/rpc/minint_snapshot", "/rest/v1/rpc/minint_commit", "/rest/v1/rpc/minint_storage_health"]) {
      const args = path.endsWith("minint_commit") ? { p_id: "0".repeat(24), p_expected_version: 0, p_document: {}, p_deadline_ms: null } : path.endsWith("minint_snapshot") ? { p_id: "0".repeat(24) } : {};
      const denied = await post(path, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, args);
      if (![401, 403, 404].includes(denied.status)) throw new Error("Anonymous RPC access was not denied. Check grants before enabling the app.");
    }
    const table = await fetch(`${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/minint_app_snapshots?select=id&limit=1`, { headers: headers(env.NEXT_PUBLIC_SUPABASE_ANON_KEY), signal: AbortSignal.timeout(8000) });
    if (![401, 403].includes(table.status)) throw new Error("Anonymous table access was not denied. Check table grants.");
    console.log("Anonymous snapshot/RPC access denied: OK");
    const topic = `minint-check:${randomBytes(16).toString("hex")}`;
    const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    try {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Realtime check timed out. Check Realtime settings and network access.")), 12000);
        const fail = (message) => { clearTimeout(timeout); reject(new Error(message)); };
        client.channel(topic, { config: { private: false } }).on("broadcast", { event: "state_changed" }, ({ payload }) => {
          if (payload?.check === topic) { clearTimeout(timeout); resolve(); }
        }).subscribe(async (status) => {
          if (["CHANNEL_ERROR", "TIMED_OUT"].includes(status)) return fail("Realtime subscription failed.");
          if (status !== "SUBSCRIBED") return;
          try {
            // Only a synthetic message on a random test topic. No room data is changed.
            const sent = await post("/realtime/v1/api/broadcast", env.SUPABASE_SERVICE_ROLE_KEY, { messages: [{ topic, event: "state_changed", payload: { check: topic }, private: false }] });
            if (!sent.ok) fail("Realtime broadcast failed.");
          } catch { fail("Realtime broadcast request failed."); }
        });
      });
      console.log("Public Realtime subscribe and broadcast: OK (database delivery is covered by app smoke)");
    } finally { await client.removeAllChannels(); }
  } catch (error) {
    // Do not print raw provider errors, bodies, URLs or credentials.
    console.error(error instanceof Error && /^(Database check|Anonymous |Realtime )/.test(error.message) ? error.message : "Supabase connectivity check failed.");
    process.exitCode = 1;
  }
}
