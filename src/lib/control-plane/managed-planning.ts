import "server-only";
import { AppError } from "@/lib/api/app-error-codes";
import { PlanningReplySchema, PlanningErrorCodeSchema, PLANNING_TIMEOUT_MS, type PlanningRequest } from "@/lib/api/planning-contract";
import { readyWorkerAgents } from "./worker-agents";

/** The Control Plane holds no OpenAI key, so planning runs on a Worker like generation does. Do not retry a paid request on another worker. */
export async function managedPlan(input: PlanningRequest, signal: AbortSignal) {
  const [agent] = await readyWorkerAgents();
  if (!agent || !process.env.WORKER_TOKEN) throw new AppError("runtime_unavailable");
  try {
    const response = await fetch(`${agent}/plan`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.WORKER_TOKEN}` },
      body: JSON.stringify(input), redirect: "error", cache: "no-store",
      signal: AbortSignal.any([signal, AbortSignal.timeout(PLANNING_TIMEOUT_MS + 2000)]),
    });
    // The private protocol is small; reject invalid or oversized upstream responses.
    const body = await response.text();
    if (body.length > 16384) throw new AppError("ai_invalid_output");
    const value: unknown = JSON.parse(body);
    if (!response.ok) {
      const code = PlanningErrorCodeSchema.safeParse((value as { code?: unknown } | null)?.code);
      throw new AppError(code.success ? code.data : "ai_unavailable");
    }
    const reply = PlanningReplySchema.safeParse(value);
    if (!reply.success) throw new AppError("ai_invalid_output");
    return reply.data;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (signal.aborted || error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)) throw new AppError("ai_timeout");
    throw new AppError("ai_unavailable");
  }
}
