import "server-only";
import { pool } from "../../../platform/store";
import { PlanningReplySchema, PlanningErrorCodeSchema, PLANNING_TIMEOUT_MS, type PlanningRequest } from "@/lib/api/planning-contract";
import { AppError } from "@/lib/api/app-error-codes";

/** Control Plane never receives the AI key. Do not retry a paid request on another worker. */
export async function planViaWorker(input: PlanningRequest, signal: AbortSignal) {
  const allowed = new Set((process.env.WORKER_AGENT_URLS || "").split(",").map(url => url.trim()).filter(Boolean));
  try {
    const workers = await pool.query<{ agent_url: string }>(`SELECT agent_url FROM workers
      WHERE heartbeat_at>now()-interval '30 seconds' AND $1=ANY(available_images) ORDER BY id LIMIT 100`, [process.env.RUNTIME_IMAGE]);
    const worker = workers.rows.find(row => allowed.has(row.agent_url));
    if (!worker || !process.env.WORKER_TOKEN) throw new AppError("ai_unavailable");
    const response = await fetch(`${worker.agent_url}/plan`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.WORKER_TOKEN}` },
      body: JSON.stringify(input), redirect: "error", cache: "no-store",
      signal: AbortSignal.any([signal, AbortSignal.timeout(PLANNING_TIMEOUT_MS + 2000)]),
    });
    // The private protocol is small; reject invalid or oversized upstream responses.
    const body = await response.text();
    if (body.length > 16384) throw new AppError("ai_invalid_output");
    let value: unknown;
    try { value = JSON.parse(body); }
    catch { throw new AppError(response.ok ? "ai_invalid_output" : "ai_unavailable"); }
    if (!response.ok) {
      const code = PlanningErrorCodeSchema.safeParse((value as { code?: unknown } | null)?.code);
      throw new AppError(code.success ? code.data : "ai_unavailable");
    }
    const result = PlanningReplySchema.safeParse(value);
    if (!result.success) throw new AppError("ai_invalid_output");
    return result.data;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (signal.aborted || error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)) throw new AppError("ai_timeout");
    throw new AppError("ai_unavailable");
  }
}
