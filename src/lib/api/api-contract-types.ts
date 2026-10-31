import type { z } from "zod";
import type { GenerateRequestSchema, RemixRequestSchema, TemplateCreateRequestSchema, SubmitResponseRequestSchema, BlockActionRequestSchema, LifecycleRequestSchema } from "./request-schemas";
import type { ErrorCode } from "./app-error-codes";
import type { GenerationMeta } from "@/lib/generation/llm-output-types";
export type { ResponsePayload } from "@/lib/blocks/block-registry";
export type { PublicAppSpec } from "@/lib/app-spec/strip-private-fields";
export type { AppRuntime } from "@/lib/blocks/block-definition-types";
export type AppStatus = "active" | "closed" | "ended" | "blocked";
export type Lifetime = GenerateRequest["lifetime"];
export const LIFETIME_MS = { "1h": 3_600_000, "24h": 86_400_000, "7d": 604_800_000 } satisfies Record<Lifetime, number>;
export const STATE_REFRESH_HEADER = "x-state-refresh";
export type GenerateRequest = z.output<typeof GenerateRequestSchema>;
export type RemixRequest = z.output<typeof RemixRequestSchema>;
export type TemplateCreateRequest = z.output<typeof TemplateCreateRequestSchema>;
export type SubmitResponseRequest = z.output<typeof SubmitResponseRequestSchema>;
export type BlockActionRequest = z.output<typeof BlockActionRequestSchema>;
export type LifecycleRequest = z.output<typeof LifecycleRequestSchema>;
// UI progress states. POST /api/generate returns a single JSON GenerateResponse.
export type GenerateEvent = { stage: "thinking" | "validating" }
  | { stage: "done"; id: string; hostToken: string; generation?: GenerationMeta }
  | { stage: "error" | "refused" | "unsupported"; code: ErrorCode; message: string };
export interface ApiErrorResponse { ok: false; code: ErrorCode; message: string }
export type TemplateCreateResponse = { ok: true; id: string; hostToken: string } | ApiErrorResponse;
export type RemixResponse = { ok: true; newId: string; hostToken: string } | ApiErrorResponse;

export type AppSync = { mode: "memory" } | { mode: "supabase"; url: string; publicKey: string; channel: string };
export interface AppStateResponse {
  sync?: AppSync;
  id: string; status: AppStatus; expiresAt: string; stateVersion: number;
  spec: import("@/lib/app-spec/strip-private-fields").PublicAppSpec;
  runtime: import("@/lib/blocks/block-definition-types").AppRuntime;
  isHost: boolean; participantCount: number;
  results: import("@/lib/responses/compute-results").BlockResults[];
  myAnswers: Record<string, import("@/lib/blocks/block-registry").ResponsePayload>;
}

export type GenerateResponse = { ok: true; id: string; hostToken: string; generation: GenerationMeta } | ApiErrorResponse;
