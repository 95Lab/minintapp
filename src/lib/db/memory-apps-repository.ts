import "server-only";
import { randomBytes } from "node:crypto";
import { AppSpecSchema } from "@/lib/app-spec/app-spec-schema";
import { initialRuntime } from "@/lib/blocks/block-definition-types";
import { hashToken, newToken, verifyToken } from "@/lib/security/token-hashing";
import { AppError } from "@/lib/api/app-error-codes";
import { validatePollResponse } from "@/lib/responses/validate-response-payload";
import { isUsable, type AppRecord, type AppsRepository, type ResponseRecord, type SubmitOutcome } from "./apps-repository-types";

type Entry = { app: AppRecord; rows: Map<string, ResponseRecord> };
export class MemoryAppsRepository implements AppsRepository {
  private entries = new Map<string, Entry>();
  constructor(private readonly now = Date.now, private readonly limits = { apps: 200, responses: 1000 }) {}

  async createApp(input: Parameters<AppsRepository["createApp"]>[0]) {
    const now = this.now();
    for (const [id, entry] of this.entries) if (entry.app.expiresAt + 600_000 <= now) this.entries.delete(id);
    if (this.entries.size >= this.limits.apps) throw new AppError("rate_limited");
    if (!Number.isSafeInteger(input.lifetimeMs) || input.lifetimeMs <= 0 || input.lifetimeMs > 7 * 86_400_000) throw new AppError("invalid_request");
    const hostToken = newToken();
    const app: AppRecord = {
      id: randomBytes(12).toString("hex"), spec: AppSpecSchema.parse(input.spec), prompt: input.prompt,
      hostTokenHash: hashToken(hostToken), parentId: input.parentId ?? null, movedTo: null,
      status: "active", runtime: initialRuntime(), stateVersion: 1, createdAt: now, expiresAt: now + input.lifetimeMs,
      endedAt: null, ownerId: input.ownerId ?? null, announcement: null,
    };
    this.entries.set(app.id, { app, rows: new Map() });
    return { app: structuredClone(app), hostToken };
  }
  async snapshot(id: string) {
    const entry = this.entries.get(id);
    return entry ? structuredClone({ app: entry.app, responses: [...entry.rows.values()] }) : null;
  }
  async findApp(id: string) { return structuredClone(this.entries.get(id)?.app ?? null); }
  async listResponses(id: string) { return structuredClone([...this.entries.get(id)?.rows.values() ?? []]); }
  async submitResponse(id: string, response: Omit<ResponseRecord, "createdAt">): Promise<SubmitOutcome> {
    const entry = this.entries.get(id);
    if (!entry || !isUsable(entry.app, this.now())) return "gone";
    if (entry.app.status !== "active") return "closed";
    validatePollResponse(entry.app.spec, response.blockId, response.itemId, response.payload);
    const key = JSON.stringify([response.blockId, response.itemId, response.participantHash]);
    if (!entry.rows.has(key) && entry.rows.size >= this.limits.responses) return "limit";
    // No await between checks and mutation: one atomic operation within this process.
    entry.rows.set(key, structuredClone({ ...response, createdAt: this.now() }));
    entry.app.stateVersion++;
    return "ok";
  }
  async transition(id: string, token: string, action: "close" | "reopen" | "end") {
    const entry = this.entries.get(id);
    if (!entry) throw new AppError("not_found");
    if (!verifyToken(token, entry.app.hostTokenHash)) throw new AppError("forbidden");
    if (!isUsable(entry.app, this.now())) throw new AppError("app_gone");
    entry.app.status = action === "close" ? "closed" : action === "reopen" ? "active" : "ended";
    if (action === "end") { entry.rows.clear(); entry.app.endedAt = this.now(); }
    entry.app.stateVersion++;
  }
}
