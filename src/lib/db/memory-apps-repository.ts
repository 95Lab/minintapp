import "server-only";
import { AppError } from "@/lib/api/app-error-codes";
import { createAppRecord, applySubmission, applyBlockAction, applyTransition } from "./app-mutations";
import type { AppsRepository, AppSnapshot, AppRecord, ResponseRecord, SubmitOutcome } from "./apps-repository-types";
export type StoredApp = AppSnapshot;
export interface AppPersistence { load(): StoredApp[]; save(snapshot: StoredApp): void; delete(id: string): void }
export class MemoryAppsRepository implements AppsRepository {
  private entries = new Map<string, AppSnapshot>();
  constructor(private readonly now = Date.now, private readonly limits = { apps: 200, responses: 1000 }, private readonly persistence?: AppPersistence) {
    for (const snapshot of persistence?.load() ?? []) this.entries.set(snapshot.app.id, snapshot);
  }
  private commit(snapshot: AppSnapshot) { this.persistence?.save(snapshot); this.entries.set(snapshot.app.id, snapshot); }
  async createApp(input: Parameters<AppsRepository["createApp"]>[0]) {
    const now = this.now();
    for (const [id, entry] of this.entries) if (entry.app.expiresAt + 600_000 <= now) { this.persistence?.delete(id); this.entries.delete(id); }
    if (this.entries.size >= this.limits.apps) throw new AppError("rate_limited");
    const result = createAppRecord(input, now);
    this.commit({ app: result.app, responses: [] });
    return structuredClone(result);
  }
  async mutateSnapshot<T>(id: string, mutate: (snapshot: AppSnapshot, now: number) => { value: T; changed: boolean }): Promise<T | null> {
    const entry = this.entries.get(id); if (!entry) return null;
    const copy = structuredClone(entry), result = mutate(copy, this.now());
    if (result.changed) { copy.app.stateVersion = entry.app.stateVersion + 1; this.commit(copy); }
    return result.value;
  }
  async compareAndSwap(id: string, expected: number, next: AppSnapshot) {
    const current = this.entries.get(id);
    if (!current || current.app.stateVersion !== expected) return false;
    if (next.app.id !== id || next.app.hostTokenHash !== current.app.hostTokenHash || next.app.createdAt !== current.app.createdAt ||
      (current.app.ownerId && current.app.ownerId !== next.app.ownerId)) throw new AppError("forbidden");
    const copy = structuredClone(next); copy.app.stateVersion = expected + 1;
    this.commit(copy); return true;
  }
  async listAppsByOwner(userId: string): Promise<AppRecord[]> {
    return structuredClone([...this.entries.values()].map(s => s.app).filter(a => a.ownerId === userId && a.status !== "ended" && a.expiresAt > this.now()).sort((a,b) => b.createdAt-a.createdAt));
  }
  async snapshot(id: string) { return structuredClone(this.entries.get(id) ?? null); }
  async findApp(id: string) { return structuredClone(this.entries.get(id)?.app ?? null); }
  async listResponses(id: string) { return structuredClone(this.entries.get(id)?.responses ?? []); }
  async submitResponse(id: string, response: Omit<ResponseRecord, "createdAt">): Promise<SubmitOutcome> {
    const stored = this.entries.get(id); if (!stored) return "gone";
    const copy = structuredClone(stored), result = applySubmission(copy, response, this.now(), this.limits.responses);
    if (result === "ok") this.commit(copy);
    return result;
  }
  async blockAction(id: string, token: string, input: Parameters<AppsRepository["blockAction"]>[2]) {
    const stored = this.entries.get(id); if (!stored) throw new AppError("not_found");
    const copy = structuredClone(stored); applyBlockAction(copy, token, input, this.now()); this.commit(copy);
  }
  async transition(id: string, token: string, action: Parameters<AppsRepository["transition"]>[2]) {
    const stored = this.entries.get(id); if (!stored) throw new AppError("not_found");
    const copy = structuredClone(stored); applyTransition(copy, token, action, this.now()); if (action === "end") copy.extension = {}; this.commit(copy);
  }
}
