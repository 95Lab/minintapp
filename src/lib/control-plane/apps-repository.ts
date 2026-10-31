import "server-only";
import { AppError, ERROR_STATUS, type ErrorCode } from "@/lib/api/app-error-codes";
import type { AppsRepository, AppRecord } from "@/lib/db/apps-repository-types";
import { deployment, pool } from "../../../platform/store";

export class ControlPlaneAppsRepository implements AppsRepository {
  async createApp(): ReturnType<AppsRepository["createApp"]> { throw new Error("Use deployment service to create managed apps"); }
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
