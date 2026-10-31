import "server-only";
import { AppError, ERROR_STATUS, type ErrorCode } from "@/lib/api/app-error-codes";
import type { AppsRepository, AppRecord } from "@/lib/db/apps-repository-types";
import { deployment, pool } from "../../../platform/store";
import { submitDeployment } from "./deployments";
import { LIFETIME_MS } from "@/lib/api/api-contract-types";
import type { AppSnapshot } from "@/lib/db/apps-repository-types";

export class ControlPlaneAppsRepository implements AppsRepository {
  async createApp(input: Parameters<AppsRepository["createApp"]>[0]): ReturnType<AppsRepository["createApp"]> {
    const lifetime = (Object.keys(LIFETIME_MS) as (keyof typeof LIFETIME_MS)[]).find((key) => LIFETIME_MS[key] === input.lifetimeMs);
    if (!lifetime) throw new AppError("invalid_request");
    const created = await submitDeployment({ spec: input.spec, prompt: input.prompt, lifetime, ownerId: input.ownerId || undefined, parentId: input.parentId || undefined }, input.ownerId || `anonymous-${crypto.randomUUID()}`);
    for (let attempt = 0; attempt < 180; attempt++) {
      const record = await deployment(created.id);
      if (record?.state === "RUNNING") return { app: (await this.findApp(created.id))!, hostToken: created.hostToken };
      if (!record || ["FAILED", "EXPIRED", "DELETED"].includes(record.state)) throw new AppError("deployment_failed");
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new AppError("deployment_pending");
  }
  async mutateSnapshot<T>(id: string, mutate: (snapshot: AppSnapshot, now: number) => { value: T; changed: boolean }): Promise<T | null> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const snapshot = await this.snapshot(id); if (!snapshot) return null;
      const expected = snapshot.app.stateVersion;
      const result = mutate(snapshot, Date.now());
      if (!result.changed) return result.value;
      if (await this.rpc<boolean>(id, "compareAndSwap", [expected, snapshot])) {
        await pool.query("UPDATE deployments SET expires_at=$2,owner_id=COALESCE($3,owner_id) WHERE id=$1", [id, new Date(snapshot.app.status === "ended" ? Date.now() : snapshot.app.expiresAt), snapshot.app.ownerId]);
        return result.value;
      }
    }
    throw new AppError("rate_limited");
  }
  async listAppsByOwner(userId: string) {
    const records = await pool.query<{ id: string }>("SELECT id FROM deployments WHERE owner_id=$1 AND state='RUNNING' AND expires_at>now() ORDER BY created_at DESC", [userId]);
    const apps = await Promise.all(records.rows.map((row) => this.findApp(row.id)));
    return apps.filter((app): app is AppRecord => !!app && app.ownerId === userId && app.status !== "ended");
  }
  private async rpc<T>(id: string, op: string, args: unknown[] = []): Promise<T> {
    const app = await deployment(id);
    if (!app) throw new AppError("not_found");
    if (app.expires_at.getTime() <= Date.now() || ["EXPIRED", "DELETED"].includes(app.state)) throw new AppError("app_gone");
    if (app.state !== "RUNNING") throw new AppError("deployment_pending");
    const worker = (await pool.query<{ agent_url: string }>("SELECT agent_url FROM workers WHERE id=$1 AND heartbeat_at > now()-interval '30 seconds'", [app.worker_id])).rows[0];
    const allowlist = (process.env.WORKER_AGENT_URLS || "").split(",");
    if (!worker || !allowlist.includes(worker.agent_url)) throw new AppError("runtime_unavailable");
    const response = await fetch(`${worker.agent_url}/runtime/${id}`, { method: "POST", headers: {
      Authorization: `Bearer ${process.env.WORKER_TOKEN}`, "Content-Type": "application/json",
    }, body: JSON.stringify({ op, args }), signal: AbortSignal.timeout(10000), cache: "no-store" });
    const body = await response.json();
    if (!response.ok) {
      if (typeof body.code === "string" && Object.hasOwn(ERROR_STATUS, body.code)) throw new AppError(body.code as ErrorCode);
      throw new AppError("runtime_unavailable");
    }
    return body.result as T;
  }
  snapshot(id: string): ReturnType<AppsRepository["snapshot"]> { return this.rpc(id, "snapshot"); }
  async findApp(id: string): Promise<AppRecord | null> { return (await this.snapshot(id))?.app ?? null; }
  listResponses(id: string): ReturnType<AppsRepository["listResponses"]> { return this.rpc(id, "listResponses"); }
  submitResponse(...args: Parameters<AppsRepository["submitResponse"]>): ReturnType<AppsRepository["submitResponse"]> { return this.rpc(args[0], "submitResponse", [args[1]]); }
  blockAction(...args: Parameters<AppsRepository["blockAction"]>): ReturnType<AppsRepository["blockAction"]> { return this.rpc(args[0], "blockAction", args.slice(1)); }
  async transition(...args: Parameters<AppsRepository["transition"]>) {
    await this.rpc(args[0], "transition", args.slice(1));
    if (args[2] === "end") await pool.query("UPDATE deployments SET expires_at=now() WHERE id=$1", [args[0]]);
  }
}
