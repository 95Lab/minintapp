import "server-only";
import { pool } from "../../../platform/store";
import { tenantIdentity } from "./deployments";
import type { AppsRepository } from "@/engine/db/apps-repository-types";
export async function claimBrowserApps(request: Request, userId: string, repo: AppsRepository) {
  const tenant = tenantIdentity(request);
  const rows = await pool.query<{id:string}>("SELECT id FROM deployments WHERE owner_id=$1 AND state='RUNNING' AND expires_at>now() ORDER BY created_at DESC LIMIT 50", [tenant.id]);
  const claimed: string[] = [];
  for (const row of rows.rows) {
    const app = await repo.findApp(row.id);
    if (app && !app.ownerId && await repo.setOwner(row.id,userId)) claimed.push(row.id);
  }
  return claimed;
}
