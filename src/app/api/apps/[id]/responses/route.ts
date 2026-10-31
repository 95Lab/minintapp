import { parseBody, SubmitResponseRequestSchema } from "@/lib/api/request-schemas";
import { noStoreJson, requireApp } from "@/lib/api/poll-service";
import { errorResponse } from "@/lib/api/route-helpers";
import { AppError } from "@/lib/api/app-error-codes";
import { appsRepository } from "@/lib/db/apps-repository";
import { participantHashFor } from "@/lib/security/token-hashing";
import { requireSameOrigin } from "@/lib/host/host-session";
export const runtime = "nodejs";
export async function POST(request: Request, context: RouteContext<"/api/apps/[id]/responses">) {
  try {
    requireSameOrigin(request);
    const { id } = await context.params;
    await requireApp(id);
    const input = await parseBody(request, SubmitResponseRequestSchema);
    if (!input) throw new AppError("invalid_request");
    const outcome = await appsRepository.submitResponse(id, {
      blockId: input.blockId, itemId: input.itemId, payload: input.payload,
      participantHash: participantHashFor(id, input.participantToken), displayName: input.displayName,
    });
    if (outcome !== "ok") throw new AppError(outcome === "closed" ? "app_closed" : outcome === "limit" ? "rate_limited" : "app_gone");
    return noStoreJson({ ok: true });
  } catch (error) { return errorResponse(error); }
}
