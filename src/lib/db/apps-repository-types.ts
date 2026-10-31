import type { AppSpec } from "@/lib/app-spec/app-spec-schema";
import type { AppStatus, ResponsePayload } from "@/lib/api/api-contract-types";
import type { AppRuntime } from "@/lib/blocks/block-definition-types";
export interface AppRecord {
  id: string; spec: AppSpec; prompt: string; parentId: string | null; movedTo: string | null;
  hostTokenHash: string; status: AppStatus; runtime: AppRuntime; stateVersion: number;
  createdAt: number; expiresAt: number; endedAt: number | null; ownerId: string | null;
  announcement: { text: string; at: number } | null;
}
export interface ResponseRecord {
  blockId: string; itemId: string; participantHash: string; displayName: string | null;
  payload: ResponsePayload; createdAt: number;
}
export type SubmitOutcome = "ok" | "gone" | "closed" | "limit";
// Initial repository interface, not an implementation. Advanced storage operations will extend it.
export interface AppsRepository {
  createApp(input: { spec: AppSpec; prompt: string; lifetimeMs: number; parentId?: string | null; ownerId?: string | null }): Promise<{ app: AppRecord; hostToken: string }>;
  findApp(id: string): Promise<AppRecord | null>;
  listResponses(appId: string): Promise<ResponseRecord[]>;
  submitResponse(appId: string, response: Omit<ResponseRecord, "createdAt">): Promise<SubmitOutcome>;
}
export const isExpired = (app: Pick<AppRecord, "status" | "expiresAt">, now = Date.now()) => app.status === "ended" || app.expiresAt <= now;
export const isUsable = (app: AppRecord | null, now = Date.now()): app is AppRecord => !!app && !isExpired(app, now) && app.status !== "blocked";
