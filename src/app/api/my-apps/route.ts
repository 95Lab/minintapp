import { tenantIdentity } from "@/lib/control-plane/deployments";
import { pool } from "../../../../platform/store";
export const runtime = "nodejs";
export async function GET(request: Request) {
  if (process.env.PLATFORM_ROLE !== "control") return Response.json({ apps: [] });
  const tenant = tenantIdentity(request);
  const result = await pool.query("SELECT id,state,hostname,created_at,expires_at FROM deployments WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 100", [tenant.id]);
  return Response.json({ apps: result.rows }, { headers: { "Cache-Control": "no-store" } });
}
