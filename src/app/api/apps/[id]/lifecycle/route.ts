import { parseBody, LifecycleRequestSchema } from "@/lib/api/request-schemas";
import { noStoreJson, requireApp } from "@/lib/api/poll-service";
import { errorResponse } from "@/lib/api/route-helpers";
import { AppError } from "@/lib/api/app-error-codes";
import { appsRepository } from "@/lib/db/apps-repository";
import { requireHost, requireSameOrigin } from "@/lib/host/host-session";
export const runtime = "nodejs";
export async function POST(request: Request, context: RouteContext<"/api/apps/[id]/lifecycle">) {
  try {
    requireSameOrigin(request);
    const { id } = await context.params;
    const app = await requireApp(id);
    const token = requireHost(request, app);
    const input = await parseBody(request, LifecycleRequestSchema);
    if (!input || !["close", "reopen", "end"].includes(input.action)) throw new AppError("invalid_request");
    if (input.action === "close" || input.action === "reopen" || input.action === "end") await appsRepository.transition(id, token, input.action);
    return noStoreJson({ ok: true });
  } catch (error) { return errorResponse(error); }
}
