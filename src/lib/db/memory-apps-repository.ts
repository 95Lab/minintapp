import "server-only";
import { randomBytes } from "node:crypto";
import { AppSpecSchema } from "@/lib/app-spec/app-spec-schema";
import { initialRuntime } from "@/lib/blocks/block-definition-types";
import { hashToken, newToken, verifyToken } from "@/lib/security/token-hashing";
import { AppError } from "@/lib/api/app-error-codes";
import { validateAppResponse } from "@/lib/responses/validate-response-payload";
import { applyHostAction } from "@/lib/blocks/host-actions";
import type { BlockActionRequest } from "@/lib/api/api-contract-types";
import { isUsable, type AppRecord, type AppsRepository, type ResponseRecord, type SubmitOutcome } from "./apps-repository-types";

export type StoredApp = { app: AppRecord; responses: ResponseRecord[] };
export interface AppPersistence { load(): StoredApp[]; save(snapshot: StoredApp): void; delete(id: string): void }
type Entry = { app: AppRecord; rows: Map<string, ResponseRecord> };
export class MemoryAppsRepository implements AppsRepository {
  private entries = new Map<string, Entry>();
  constructor(private readonly now = Date.now, private readonly limits = { apps: 200, responses: 1000 }, private readonly persistence?: AppPersistence) {
    for (const stored of persistence?.load() ?? []) this.entries.set(stored.app.id, {
      app: stored.app, rows: new Map(stored.responses.map((row) => [JSON.stringify([row.blockId, row.itemId, row.participantHash]), row])),
    });
  }
  private persist(entry: Entry) { this.persistence?.save({ app: entry.app, responses: [...entry.rows.values()] }); }

  async createApp(input: Parameters<AppsRepository["createApp"]>[0]) {
    const now = this.now();
    for (const [id, entry] of this.entries) if (entry.app.expiresAt + 600_000 <= now) { this.persistence?.delete(id); this.entries.delete(id); }
    if (this.entries.size >= this.limits.apps) throw new AppError("rate_limited");
    if (!Number.isSafeInteger(input.lifetimeMs) || input.lifetimeMs <= 0 || input.lifetimeMs > 7 * 86_400_000) throw new AppError("invalid_request");
    const hostToken = newToken();
    const app: AppRecord = {
      id: randomBytes(12).toString("hex"), spec: AppSpecSchema.parse(input.spec), prompt: input.prompt,
      hostTokenHash: hashToken(hostToken), parentId: input.parentId ?? null, movedTo: null,
      status: "active", runtime: initialRuntime(), stateVersion: 1, createdAt: now, expiresAt: now + input.lifetimeMs,
      endedAt: null, ownerId: input.ownerId ?? null, announcement: null,
    };
    const entry = { app, rows: new Map<string, ResponseRecord>() };
    this.persist(entry);
    this.entries.set(app.id, entry);
    return { app: structuredClone(app), hostToken };
  }
  async snapshot(id: string) {
    const entry = this.entries.get(id);
    return entry ? structuredClone({ app: entry.app, responses: [...entry.rows.values()] }) : null;
  }
  async findApp(id: string) { return structuredClone(this.entries.get(id)?.app ?? null); }
  async listResponses(id: string) { return structuredClone([...this.entries.get(id)?.rows.values() ?? []]); }
  async submitResponse(id: string, response: Omit<ResponseRecord, "createdAt">): Promise<SubmitOutcome> {
    const stored = this.entries.get(id);
    const entry = stored ? structuredClone(stored) : undefined;
    if (!entry || !isUsable(entry.app, this.now())) return "gone";
    if (entry.app.status !== "active") return "closed";
    validateAppResponse(entry.app, response);
    const key = JSON.stringify([response.blockId, response.itemId, response.participantHash]);
    if (!entry.rows.has(key) && entry.rows.size >= this.limits.responses) return "limit";
    // No await between checks and mutation: one atomic operation within this process.
    entry.rows.set(key, structuredClone({ ...response, displayName: response.displayName?.trim() || null, createdAt: this.now() }));
    entry.app.stateVersion++;
    this.persist(entry);
    this.entries.set(id, entry);
    return "ok";
  }
  async blockAction(id: string, token: string, input: BlockActionRequest) {
    const stored = this.entries.get(id);
    const entry = stored ? structuredClone(stored) : undefined;
    if (!entry) throw new AppError("not_found");
    if (!verifyToken(token, entry.app.hostTokenHash)) throw new AppError("forbidden");
    if (!isUsable(entry.app, this.now())) throw new AppError("app_gone");
    if (entry.app.status !== "active") throw new AppError("app_closed");
    applyHostAction(entry.app, [...entry.rows.values()], input, this.now());
    entry.app.stateVersion++;
    this.persist(entry);
    this.entries.set(id, entry);
  }
  async transition(id: string, token: string, action: "close" | "reopen" | "end") {
    const stored = this.entries.get(id);
    const entry = stored ? structuredClone(stored) : undefined;
    if (!entry) throw new AppError("not_found");
    if (!verifyToken(token, entry.app.hostTokenHash)) throw new AppError("forbidden");
    if (!isUsable(entry.app, this.now())) throw new AppError("app_gone");
    entry.app.status = action === "close" ? "closed" : action === "reopen" ? "active" : "ended";
    if (action === "end") { entry.rows.clear(); entry.app.runtime = initialRuntime(); entry.app.endedAt = this.now(); }
    entry.app.stateVersion++;
    this.persist(entry);
    this.entries.set(id, entry);
  }
}
