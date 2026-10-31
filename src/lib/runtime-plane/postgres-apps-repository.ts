import "server-only";
import { Pool, type PoolClient } from "pg";
import { AppError } from "@/lib/api/app-error-codes";
import { applySubmission, applyBlockAction, applyTransition } from "@/lib/db/app-mutations";
import type { AppsRepository, AppSnapshot, AppRecord } from "@/lib/db/apps-repository-types";

/** One restricted login/database per app. PostgreSQL row locks serialize writers across processes. */
export class PostgresAppRepository implements AppsRepository {
  constructor(private readonly pool: Pool, private readonly appId: string) {}
  private boundary(id: string) { if (id !== this.appId) throw new AppError("not_found"); }
  async snapshot(id: string): Promise<AppSnapshot | null> {
    if (id !== this.appId) return null;
    try { return (await this.pool.query<{ document: AppSnapshot }>("SELECT document FROM app_snapshot WHERE id=$1", [id])).rows[0]?.document ?? null; }
    catch { throw new AppError("storage_unavailable"); }
  }
  async findApp(id: string) { return (await this.snapshot(id))?.app ?? null; }
  async listResponses(id: string) { return (await this.snapshot(id))?.responses ?? []; }
  async listAppsByOwner(owner: string): Promise<AppRecord[]> {
    const app = await this.findApp(this.appId);
    return app?.ownerId === owner && app.status !== "ended" && app.expiresAt > Date.now() ? [app] : [];
  }
  async createApp(): ReturnType<AppsRepository["createApp"]> { throw new AppError("forbidden"); }
  private async locked<T>(id: string, operation: (snapshot: AppSnapshot | null, now: number, client: PoolClient) => Promise<T>): Promise<T> {
    this.boundary(id);
    const client = await this.pool.connect().catch(() => { throw new AppError("storage_unavailable"); });
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL statement_timeout='5s'");
      const current = await client.query<{ document: AppSnapshot }>("SELECT document FROM app_snapshot WHERE id=$1 FOR UPDATE", [id]);
      const now = Number((await client.query("SELECT extract(epoch FROM clock_timestamp())*1000 AS now")).rows[0].now);
      const result = await operation(current.rows[0]?.document ?? null, now, client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      if (error instanceof AppError) throw error;
      throw new AppError("storage_unavailable");
    } finally { client.release(); }
  }
  private async save(client: PoolClient, before: AppSnapshot, next: AppSnapshot, deadline?: number | null) {
    if (next.app.id !== before.app.id || next.app.hostTokenHash !== before.app.hostTokenHash || next.app.createdAt !== before.app.createdAt || (before.app.ownerId && before.app.ownerId !== next.app.ownerId)) throw new AppError("forbidden");
    next.app.stateVersion = before.app.stateVersion + 1;
    const updated = await client.query("UPDATE app_snapshot SET document=$2 WHERE id=$1 AND ($3::bigint IS NULL OR extract(epoch FROM clock_timestamp())*1000 <= $3)", [this.appId, next, deadline ?? null]);
    if (!updated.rowCount) throw new AppError("question_closed");
  }
  async mutateSnapshot<T>(id: string, mutate: (snapshot: AppSnapshot, now: number) => { value: T; changed: boolean; deadline?: number }): Promise<T | null> {
    return this.locked(id, async (current, now, client) => {
      if (!current) return null;
      const next = structuredClone(current), result = mutate(next, now);
      if (result.changed) await this.save(client, current, next, result.deadline);
      return result.value;
    });
  }
  async compareAndSwap(id: string, expected: number, next: AppSnapshot, deadline?: number | null) {
    return this.locked(id, async (current, _now, client) => {
      if (!current || current.app.stateVersion !== expected) return false;
      await this.save(client, current, structuredClone(next), deadline);
      return true;
    });
  }
  async submitResponse(id: string, response: Parameters<AppsRepository["submitResponse"]>[1]) {
    return await this.mutateSnapshot(id, (snapshot, now) => {
      const value = applySubmission(snapshot, response, now);
      const block = snapshot.app.spec.blocks.find(block => block.id === response.blockId);
      const step = snapshot.app.runtime.blocks[response.blockId]?.step;
      const input = block?.type === "compose" && block.flow === "steps" ? block.inputs.find(input => input.id === step?.current) : null;
      return { value, changed: value === "ok", deadline: input?.timeLimitSec && step?.openedAt != null ? step.openedAt + input.timeLimitSec * 1000 + 2000 : undefined };
    }) ?? "gone";
  }
  async blockAction(id: string, token: string, input: Parameters<AppsRepository["blockAction"]>[2]) {
    await this.mutateSnapshot(id, (snapshot, now) => { applyBlockAction(snapshot, token, input, now); return { value: undefined, changed: true }; });
  }
  async transition(id: string, token: string, action: Parameters<AppsRepository["transition"]>[2]) {
    await this.mutateSnapshot(id, (snapshot, now) => { applyTransition(snapshot, token, action, now); if (action === "end") snapshot.extension = {}; return { value: undefined, changed: true }; });
  }
}
export function createPostgresRuntimeRepository(connectionString: string, appId: string) {
  const pool = new Pool({ connectionString, max: 3, connectionTimeoutMillis: 5000, statement_timeout: 5000, application_name: `app-${appId}` });
  // pg emits this when an idle client drops; left unhandled, a Postgres restart kills the runtime.
  pool.on("error", () => console.error("Runtime database connection lost"));
  return new PostgresAppRepository(pool, appId);
}
