import { AppError } from "@/lib/api/app-error-codes";
import { errorResponse } from "@/lib/api/route-helpers";
import { parseBody } from "@/lib/api/request-schemas";
import { requireSameOrigin } from "@/lib/host/host-session";
import { DeploymentActionSchema } from "@/lib/api/deployment-management-contract";
import { requireManagedApp, managementDetails } from "@/lib/control-plane/deployment-management";
import { manageDeployment } from "../../../../../../platform/release-store";
export const runtime = "nodejs";
export async function GET(request: Request, context: RouteContext<"/api/apps/[id]/deployment">) {
  try {
    const { id } = await context.params;
    const app = await requireManagedApp(request, id);
    if (new URL(request.url).searchParams.get("details") === "1") {
      return Response.json(await managementDetails(request, id), { headers: { "Cache-Control": "no-store" } });
    }
    return Response.json({ state: app.state, generation: app.generation }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
export async function POST(request: Request, context: RouteContext<"/api/apps/[id]/deployment">) {
  try {
    requireSameOrigin(request);
    const { id } = await context.params;
    await requireManagedApp(request, id);
    const input = await parseBody(request, DeploymentActionSchema);
    if (!input) throw new AppError("invalid_request");
    await manageDeployment(id, input);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
