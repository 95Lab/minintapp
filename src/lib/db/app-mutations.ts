import { AppSpecSchema as EngineSpecSchema } from "@/engine/app-spec/app-spec-schema";
import "server-only";
import { randomBytes } from "node:crypto";
import { AppSpecSchema } from "@/lib/app-spec/app-spec-schema";
import { initialRuntime } from "@/lib/blocks/block-definition-types";
import { hashToken, newToken, verifyToken } from "@/lib/security/token-hashing";
import { AppError } from "@/lib/api/app-error-codes";
import { validateAppResponse } from "@/lib/responses/validate-response-payload";
import { applyHostAction } from "@/lib/blocks/host-actions";
import { MAX_ENTRIES } from "@/lib/blocks/compose/compose-atoms-schema";
import { isUsable, type AppsRepository, type AppRecord, type AppSnapshot, type ResponseRecord, type SubmitOutcome } from "./apps-repository-types";

function parseStoredSpec(value:unknown):AppRecord["spec"] {
  const legacy=AppSpecSchema.safeParse(value);
  if(legacy.success)return legacy.data;
  // v2 rooms use the wider engine contract while v1 API types stay backward compatible.
  return EngineSpecSchema.parse(value) as unknown as AppRecord["spec"];
}
export function createAppRecord(input: Parameters<AppsRepository["createApp"]>[0], now: number): { app: AppRecord; hostToken: string } {
  if (!Number.isSafeInteger(input.lifetimeMs) || input.lifetimeMs <= 0 || input.lifetimeMs > 7 * 86_400_000) throw new AppError("invalid_request");
  const hostToken = newToken();
  return { hostToken, app: {
    id: randomBytes(12).toString("hex"), spec: parseStoredSpec(input.spec), prompt: input.prompt,
    hostTokenHash: hashToken(hostToken), parentId: input.parentId ?? null, movedTo: null,
    status: "active" as const, runtime: initialRuntime(), stateVersion: 1, createdAt: now, expiresAt: now + input.lifetimeMs,
    endedAt: null, ownerId: input.ownerId ?? null, announcement: null,
  } };
}
// Synchronous domain mutations shared by memory and the transactional database adapter.
// Database callers persist only if the snapshot version still matches, otherwise revalidate.
export function applySubmission(snapshot: AppSnapshot, response: Omit<ResponseRecord, "createdAt">, now: number, limit = 1000): SubmitOutcome {
  const { app, responses } = snapshot;
  if (!isUsable(app, now)) return "gone";
  if (app.status !== "active") return "closed";
  validateAppResponse(app, response, now);
  const index = responses.findIndex((r) => r.blockId === response.blockId && r.itemId === response.itemId && r.participantHash === response.participantHash);
  if (response.payload.kind === "compose" && response.payload.removed) {
    if (index >= 0) responses.splice(index, 1);
    app.stateVersion++; return "ok";
  }
  const block = app.spec.blocks.find((b) => b.id === response.blockId);
  if (block?.type === "compose" && block.entries === "many" && index < 0 && responses.filter((r) => r.blockId === block.id && r.participantHash === response.participantHash).length >= MAX_ENTRIES) return "limit";
  if (index < 0 && responses.length >= limit) return "limit";
  const row = structuredClone({ ...response, displayName: response.displayName?.trim() || null, createdAt: index < 0 ? now : responses[index].createdAt });
  if (index < 0) responses.push(row); else responses[index] = row;
  app.stateVersion++; return "ok";
}
export function applyBlockAction(snapshot: AppSnapshot, token: string, input: Parameters<AppsRepository["blockAction"]>[2], now: number) {
  authorize(snapshot, token, now);
  if (snapshot.app.status !== "active") throw new AppError("app_closed");
  applyHostAction(snapshot.app, snapshot.responses, input, now); snapshot.app.stateVersion++;
}
function authorize(snapshot: AppSnapshot, token: string, now: number) {
  if (!verifyToken(token, snapshot.app.hostTokenHash)) throw new AppError("forbidden");
  if (!isUsable(snapshot.app, now)) throw new AppError("app_gone");
}
export function applyTransition(snapshot: AppSnapshot, token: string, action: Parameters<AppsRepository["transition"]>[2], now: number) {
  authorize(snapshot, token, now);
  const app = snapshot.app;
  app.status = action === "close" ? "closed" : action === "reopen" ? "active" : "ended";
  if (action === "end") { snapshot.responses.length = 0; app.runtime = initialRuntime(); app.endedAt = now; }
  app.stateVersion++;
}
