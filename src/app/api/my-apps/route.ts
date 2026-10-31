import { readSession } from "@/engine/auth/host-session";
import { tenantIdentity } from "@/lib/control-plane/deployments";
import { ownedDeploymentSummaries } from "../../../../platform/store";
export const runtime = "nodejs";
export async function GET(request: Request) {
  if (process.env.PLATFORM_ROLE !== "control") return Response.json({ apps: [] });
  const tenant = tenantIdentity(request);
  const apps = await ownedDeploymentSummaries([tenant.id, readSession(request)?.userId].filter((id): id is string => !!id));
  return Response.json({ apps }, { headers: { "Cache-Control": "no-store" } });
}
