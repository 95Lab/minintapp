import "server-only";
import { randomBytes } from "node:crypto";
import { AppError } from "@/lib/api/app-error-codes";
import { createAppRecord, applySubmission, applyBlockAction, applyTransition } from "./app-mutations";
import type { AppsRepository, AppSnapshot, SubmitOutcome, ResponseRecord } from "./apps-repository-types";
export type SupabaseRpc = (name: string, args: Record<string, unknown>, signal: AbortSignal) => Promise<unknown>;
export function supabaseRpc(url: string, key: string, fetcher: typeof fetch = fetch): SupabaseRpc {
  return async (name, args, signal) => {
    try {
      const response = await fetcher(`${url.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
        method: "POST", cache: "no-store", signal,
        headers: { apikey: key, ...(key.startsWith("sb_") ? {} : { Authorization: `Bearer ${key}` }), "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      if (!response.ok) throw new AppError("storage_unavailable");
      return await response.json();
    } catch { throw new AppError("storage_unavailable"); }
  };
}
interface TimedSnapshot { snapshot: AppSnapshot; now: number }
export class SupabaseAppsRepository implements AppsRepository {
  constructor(private readonly rpc: SupabaseRpc) {}
  private async read(id: string, signal: AbortSignal): Promise<TimedSnapshot | null> {
    const raw = await this.rpc("minint_snapshot", { p_id: id }, signal) as TimedSnapshot | null;
    if (raw === null) return null;
    if (!raw?.snapshot?.app || !Array.isArray(raw.snapshot.responses) || !Number.isFinite(raw.now)) throw new AppError("storage_unavailable");
    return raw;
  }
  async snapshot(id: string) { return (await this.read(id, AbortSignal.timeout(8000)))?.snapshot ?? null; }
  async findApp(id: string) { return (await this.snapshot(id))?.app ?? null; }
  async listResponses(id: string) { return (await this.snapshot(id))?.responses ?? []; }
  async createApp(input: Parameters<AppsRepository["createApp"]>[0]) {
    const result = createAppRecord(input, Date.now());
    const app = { ...result.app, realtimeChannel: randomBytes(32).toString("hex") };
    const outcome = await this.rpc("minint_commit", { p_id: app.id, p_expected_version: 0, p_document: { app, responses: [] }, p_deadline_ms: null }, AbortSignal.timeout(8000));
    if (outcome !== "ok") throw new AppError("storage_unavailable");
    return { app, hostToken: result.hostToken };
  }
  // The DB accepts exactly one update of any given version, across every Node process.
  // Never retry an uncertain network failure: a wheel spin may already have committed.
  private async mutate<T>(id: string, missing: () => T, mutate: (snapshot: AppSnapshot, now: number) => { value: T; deadline?: number }): Promise<T> {
    const signal = AbortSignal.timeout(8000);
    for (let attempt = 0; attempt < 16; attempt++) {
      const current = await this.read(id, signal);
      if (!current) return missing();
      const expected = current.snapshot.app.stateVersion;
      const { value, deadline } = mutate(current.snapshot, current.now);
      if (current.snapshot.app.stateVersion === expected) return value;
      const result = await this.rpc("minint_commit", { p_id: id, p_expected_version: expected, p_document: current.snapshot, p_deadline_ms: deadline ?? null }, signal);
      if (result === "ok") return value;
      if (result === "gone") return missing();
      if (result === "question_closed") throw new AppError("question_closed");
      if (result !== "conflict") throw new AppError("storage_unavailable");
      // Bounded jitter prevents writers repeatedly colliding in different app servers.
      await new Promise((resolve) => setTimeout(resolve, Math.random() * Math.min(100, 5 * (attempt + 1))));
    }
    throw new AppError("rate_limited");
  }
  async submitResponse(id: string, response: Omit<ResponseRecord, "createdAt">): Promise<SubmitOutcome> {
    return this.mutate<SubmitOutcome>(id, () => "gone", (snapshot, now) => {
      const value = applySubmission(snapshot, response, now);
      const block = snapshot.app.spec.blocks.find((b) => b.id === response.blockId);
      const step = snapshot.app.runtime.blocks[response.blockId]?.step;
      const input = block?.type === "compose" && block.flow === "steps" ? block.inputs.find((i) => i.id === step?.current) : null;
      return { value, deadline: input?.timeLimitSec && step?.openedAt != null ? step.openedAt + input.timeLimitSec * 1000 + 2000 : undefined };
    });
  }
  async blockAction(id: string, token: string, input: Parameters<AppsRepository["blockAction"]>[2]) {
    await this.mutate(id, () => { throw new AppError("app_gone"); }, (snapshot, now) => { applyBlockAction(snapshot, token, input, now); return { value: undefined }; });
  }
  async transition(id: string, token: string, action: Parameters<AppsRepository["transition"]>[2]) {
    await this.mutate(id, () => { throw new AppError("app_gone"); }, (snapshot, now) => { applyTransition(snapshot, token, action, now); return { value: undefined }; });
  }
}
