import "server-only";
import { AppError, ERROR_STATUS, type ErrorCode } from "@/lib/api/app-error-codes";
import { PlanningReplySchema, type PlanningRequest } from "@/lib/api/planning-contract";
import { readyWorkerAgents } from "./worker-agents";

const isErrorCode = (code: unknown): code is ErrorCode => typeof code === "string" && code in ERROR_STATUS;

/** The Control Plane holds no OpenAI key, so planning runs on a Worker like generation does. */
export async function managedPlan(input: PlanningRequest, signal: AbortSignal) {
  for (const agent of await readyWorkerAgents()) {
    let response: Response;
    try {
      response = await fetch(`${agent}/plan`, { method: "POST", headers: { Authorization: `Bearer ${process.env.WORKER_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify(input), signal, cache: "no-store" });
    } catch {
      if (signal.aborted) throw new AppError("ai_timeout");
      continue; // Another healthy worker may be available.
    }
    const body: unknown = await response.json().catch(() => null);
    if (response.ok) {
      const reply = PlanningReplySchema.safeParse(body);
      if (!reply.success) throw new AppError("ai_invalid_output");
      return reply.data;
    }
    const code = (body as { code?: unknown } | null)?.code;
    throw new AppError(isErrorCode(code) ? code : "ai_unavailable");
  }
  throw new AppError("runtime_unavailable");
}
