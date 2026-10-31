import "server-only";
import { AppError } from "@/lib/api/app-error-codes";
import { createAppRecord, applySubmission, applyBlockAction, applyTransition } from "./app-mutations";
import type { AppsRepository, AppSnapshot, ResponseRecord, SubmitOutcome } from "./apps-repository-types";
export class MemoryAppsRepository implements AppsRepository {
  private entries = new Map<string, AppSnapshot>();
  constructor(private readonly now = Date.now, private readonly limits = { apps: 200, responses: 1000 }) {}
  async createApp(input: Parameters<AppsRepository["createApp"]>[0]) {
    const now = this.now();
    for (const [id, entry] of this.entries) if (entry.app.expiresAt + 600_000 <= now) this.entries.delete(id);
    if (this.entries.size >= this.limits.apps) throw new AppError("rate_limited");
    const result = createAppRecord(input, now);
    this.entries.set(result.app.id, { app: result.app, responses: [] });
    return structuredClone(result);
  }
  async snapshot(id: string) { return structuredClone(this.entries.get(id) ?? null); }
  async findApp(id: string) { return structuredClone(this.entries.get(id)?.app ?? null); }
  async listResponses(id: string) { return structuredClone(this.entries.get(id)?.responses ?? []); }
  async submitResponse(id: string, response: Omit<ResponseRecord, "createdAt">): Promise<SubmitOutcome> {
    const entry = this.entries.get(id);
    return entry ? applySubmission(entry, response, this.now(), this.limits.responses) : "gone";
  }
  async blockAction(id: string, token: string, input: Parameters<AppsRepository["blockAction"]>[2]) {
    const entry = this.entries.get(id); if (!entry) throw new AppError("not_found");
    applyBlockAction(entry, token, input, this.now());
  }
  async transition(id: string, token: string, action: Parameters<AppsRepository["transition"]>[2]) {
    const entry = this.entries.get(id); if (!entry) throw new AppError("not_found");
    applyTransition(entry, token, action, this.now());
  }
}
