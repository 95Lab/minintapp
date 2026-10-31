import { runtimeConfig, storageMode, accountsEnabled } from "@/engine/config/runtime-config";
export const dynamic = "force-dynamic";
export async function GET() {
  let configured = !!runtimeConfig.openaiApiKey;
  let model: string | null = runtimeConfig.openaiModel;
  let storage: string = process.env.PLATFORM_ROLE === "runtime" ? "postgresql" : storageMode();
  let storageOk = true;
  if (process.env.PLATFORM_ROLE === "control") {
    storage = "postgresql";
    configured = false;
    model = null;
    try {
      const { pool } = await import("../../../../../platform/store");
      const workers = await pool.query<{ agent_url: string }>("SELECT agent_url FROM workers WHERE heartbeat_at>now()-interval '30 seconds' AND $1=ANY(available_images)", [process.env.RUNTIME_IMAGE]);
      const allowed = (process.env.WORKER_AGENT_URLS || "").split(",");
      for (const worker of workers.rows.filter((worker) => allowed.includes(worker.agent_url))) {
        try {
          const response = await fetch(`${worker.agent_url}/health`, { headers: { Authorization: `Bearer ${process.env.WORKER_TOKEN}` }, signal: AbortSignal.timeout(2000), cache: "no-store" });
          const health = await response.json();
          if (response.ok && health.aiConfigured === true) { configured = true; model = typeof health.model === "string" ? health.model : null; break; }
        } catch { /* Another healthy worker may be available. */ }
      }
    } catch { storageOk = false; }
  }
  return Response.json({ storage, storageOk, generator: configured ? "openai" : "unconfigured", generatorLabel: "OpenAI", model, realtime: storageMode() === "supabase" ? "supabase" : "polling", simulate: runtimeConfig.simulateEnabled, accountsEnabled: accountsEnabled() }, { headers: { "Cache-Control": "no-store" } });
}
