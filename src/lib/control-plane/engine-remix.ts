import "server-only";
import { createManagedApp } from "./deployments";
import { deployment, pool } from "../../../platform/store";
import { appsRepository, type AppRecord } from "@/engine/db/apps-repository";
import { createdResponse } from "@/engine/api/created-response";
import { AppError } from "@/lib/api/app-error-codes";
export async function managedEngineRemix(request: Request, parent: AppRecord, instruction: string, summary: string) {
  const created = await createManagedApp(request, { prompt: `${parent.prompt}\n→ ${instruction}`, lifetime: "1h", lifetimeMs: Math.max(60000, parent.expiresAt-Date.now()),
    ownerId: parent.ownerId || undefined, parentId: parent.id, engine: true, remix: { spec: parent.spec, instruction, summary } });
  for (let attempt = 0; attempt < 180; attempt++) {
    const current = await deployment(created.id);
    if (current?.state === "RUNNING") {
      if (!(await appsRepository().markMoved(parent.id, created.id))) {
        await pool.query("UPDATE deployments SET expires_at=now() WHERE id=$1", [created.id]);
        throw new AppError("invalid_request");
      }
      return createdResponse(request, { ok: true, newId: created.id, hostToken: created.hostToken });
    }
    if (!current || ["FAILED", "EXPIRED", "DELETED"].includes(current.state)) throw new AppError("deployment_failed");
    request.signal.throwIfAborted();
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new AppError("deployment_pending");
}
