import "server-only";
import { AppError } from "@/lib/api/app-error-codes";
import { hostTokenFrom } from "@/lib/host/host-session";
import { verifyToken } from "@/lib/security/token-hashing";
import { readSession } from "@/engine/auth/host-session";
import { tenantIdentity } from "./deployments";
import { deployment, pool } from "../../../platform/store";
import { approvedImages, releaseHistory } from "../../../platform/release-store";
import { storedLogs } from "../../../platform/logs";
import { DeploymentLogSchema, ManagedImageSchema, type DeploymentManagement } from "@/lib/api/deployment-management-contract";
import { AppId } from "../../../platform/contracts";
export async function requireManagedApp(request: Request, id: string) {
  if (process.env.PLATFORM_ROLE !== "control" || !AppId.safeParse(id).success) throw new AppError("not_found");
  const app = await deployment(id);
  if (!app) throw new AppError("not_found");
  if (!(verifyToken(hostTokenFrom(request, id), app.host_token_hash) || tenantIdentity(request).id === app.owner_id || readSession(request)?.userId === app.owner_id)) throw new AppError("forbidden");
  return app;
}
export async function managementDetails(request: Request, id: string): Promise<DeploymentManagement> {
  const app = await requireManagedApp(request, id);
  const [versions, images, logs] = await Promise.all([releaseHistory(id), approvedImages(app.worker_id), storedLogs(id)]);
  let runtimeLogsAvailable = false;
  if (app.worker_id && !["DELETED", "EXPIRED"].includes(app.state)) {
    const worker = (await pool.query<{ agent_url: string }>("SELECT agent_url FROM workers WHERE id=$1", [app.worker_id])).rows[0];
    const allowed = (process.env.WORKER_AGENT_URLS || "").split(",").map(url => url.trim()).filter(Boolean);
    if (worker && allowed.includes(worker.agent_url)) {
      try {
        const response = await fetch(`${worker.agent_url}/logs/${id}`, { headers: { Authorization: `Bearer ${process.env.WORKER_TOKEN}` }, redirect: "error", signal: AbortSignal.timeout(6000), cache: "no-store" });
        if (response.ok) {
          const live = DeploymentLogSchema.array().max(100).parse(await response.json());
          logs.push(...live); runtimeLogsAvailable = true;
        }
      } catch { /* Stored logs remain available when the worker is offline. */ }
    }
  }
  return { state: app.state, activeVersion: app.active_version, requestedVersion: app.requested_version, versions,
    images: images.filter(image => ManagedImageSchema.safeParse(image).success), logs, runtimeLogsAvailable };
}
