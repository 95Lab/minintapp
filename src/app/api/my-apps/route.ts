import { readSession } from "@/engine/auth/host-session";
import { tenantIdentity } from "@/lib/control-plane/deployments";
import { pool } from "../../../../platform/store";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const session = readSession(request);
  if (!session) return Response.json({ code: "sign_in_required" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  if (process.env.PLATFORM_ROLE !== "control") return Response.json({ apps: [] });
  const tenant = tenantIdentity(request);
  const result = await pool.query("SELECT id,state,hostname,created_at,expires_at FROM deployments WHERE owner_id=ANY($1::text[]) ORDER BY created_at DESC LIMIT 100", [[tenant.id, session.userId].filter(Boolean)]);
  return Response.json({ apps: result.rows }, { headers: { "Cache-Control": "no-store" } });
}
