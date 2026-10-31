import { readSession } from "@/engine/auth/host-session";
import { tenantIdentity } from "@/lib/control-plane/deployments";
import { ownedDeploymentSummaries } from "../../../../platform/store";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const session = readSession(request);
  if (!session) return Response.json({ code: "sign_in_required" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  if (process.env.PLATFORM_ROLE !== "control") return Response.json({ apps: [] });
  const tenant = tenantIdentity(request);
  const apps = await ownedDeploymentSummaries([tenant.id, session.userId].filter((id): id is string => !!id));
  return Response.json({ apps }, { headers: { "Cache-Control": "no-store" } });
}
