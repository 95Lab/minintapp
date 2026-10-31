// Request/response types for every API route. Shared by route handlers and client code
// so the mock backend and the future Supabase/OpenAI backend keep the same contract.
import type { GenerationMeta } from "@/engine/generation/llm-output-types";
import type { ErrorCode, ErrorParams } from "@/engine/api/app-error-codes";
import type { PublicAppSpec } from "@/engine/app-spec/strip-private-fields";

export type AppStatus = "active" | "closed" | "ended" | "blocked";
export type Lifetime = "1h" | "24h" | "7d";

export const LIFETIME_MS: Record<Lifetime, number> = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

// ---- POST /api/engine/generate (response is NDJSON stream of GenerateEvent) ----
export interface GenerateRequest {
  prompt: string;
  lifetime: Lifetime;
}
export type GenerateEvent =
  | { stage: "thinking" | "validating" }
  | { stage: "done"; id: string; hostToken: string; generation?: GenerationMeta }
  | { stage: "unsupported" | "refused"; code?: ErrorCode | (string & {}); message: string; suggestion: string | null; generation?: GenerationMeta }
  | { stage: "error"; code?: ErrorCode | (string & {}); params?: ErrorParams; message: string };

// ---- POST /api/engine/apps/[id]/remix (header x-host-token) ----
export interface RemixRequest {
  instruction: string;
}
export type RemixResponse =
  | { ok: true; newId: string; hostToken: string }
  | { ok: false; code?: ErrorCode | (string & {}); params?: ErrorParams; message: string; suggestion: string | null };

// ---- POST /api/engine/apps/from-template ----
export interface TemplateCreateRequest {
  templateId: string;
  locale: "vi" | "en";
  lifetime: Lifetime;
}
export type TemplateCreateResponse = { ok: true; id: string; hostToken: string } | { ok: false; code?: ErrorCode | (string & {}); params?: ErrorParams; message: string };

// ---- POST /api/engine/apps/[id]/responses ----
// Payload / results shapes are owned by each brick (src/lib/blocks/*) and unioned in the registry.
import type { BlockResults, ResponsePayload } from "@/engine/blocks/block-registry";
export type { ResponsePayload, BlockResults };
export type { QuizResults } from "@/engine/blocks/quiz/quiz-block";
export type { WheelResults, WheelSpin } from "@/engine/blocks/wheel/wheel-block";
export type { CustomResults, CustomAnswer } from "@/engine/blocks/custom/custom-block";
export type { LiveResults } from "@/engine/blocks/live/live-block";
export type { LiveData, WeatherData, FxData, WeatherDay } from "@/engine/live-data/live-data-fetchers";
export type { ComposeResults } from "@/engine/blocks/compose/compose-block";
export type { ComposeViewResult } from "@/engine/blocks/compose/compose-view-aggregators";
export type { AppRuntime } from "@/engine/blocks/block-definition-types";

/** GET /state request header: "signal" when a realtime signal triggered the refetch (read fresh), absent for polls. */
export const STATE_REFRESH_HEADER = "x-state-refresh";

export interface SubmitResponseRequest {
  blockId: string;
  itemId: string; // quiz: question id; otherwise ""
  participantToken: string;
  displayName: string | null;
  payload: ResponsePayload;
}

// ---- POST /api/engine/apps/[id]/block-action (host) ----
// e.g. quiz {action:"open", args:{questionId}} · wheel {action:"spin"} / {action:"reset"}
export interface BlockActionRequest {
  blockId: string;
  action: string;
  args?: Record<string, string | number | boolean>;
}

// ---- POST /api/engine/apps/[id]/lifecycle (host) ----
export type LifecycleRequest =
  | { action: "close" }
  | { action: "end" }
  | { action: "reopen" }
  | { action: "extend"; by: Lifetime }
  | { action: "announce"; text: string | null }
  /** the bank account a settle-up view's QR pays into (null clears it); name is normalized to A–Z on the server */
  | { action: "payee"; payee: { bin: string; account: string; name: string } | null }
  | { action: "redirect"; toId: string; toHostToken: string };

// ---- GET /api/engine/apps/[id]/state ----
export interface AppStateResponse {
  shareUrl?: string;
  /** Public destination on the child runtime; contains no host credentials. */
  movedToUrl?: string;
  sync?:import("@/lib/api/api-contract-types").AppSync;
  id: string;
  status: AppStatus;
  movedTo: string | null;
  expiresAt: string;
  endedAt: string | null;
  stateVersion: number;
  /** The host's message to everyone, `at` in epoch ms; null when none. */
  announcement: { text: string; at: number } | null;
  /** Where a settle-up QR pays (host-set, public to everyone with the link); null when none. */
  payee: import("@/engine/money/payee").PublicPayee | null;
  prompt: string;
  spec: PublicAppSpec;
  runtime: import("@/engine/blocks/block-definition-types").AppRuntime;
  /** null entries mean "hidden for this viewer right now" */
  results: Array<BlockResults | null>;
  participantCount: number;
  isHost: boolean;
  /** this participant's saved answers, keyed by `${blockId}:${itemId}` */
  myAnswers: Record<string, ResponsePayload>;
}

/** 410/404 body when an app can no longer be used. `prompt` lets the UI offer "create a similar app". */
export interface GoneResponse {
  gone: true;
  reason: "expired" | "ended" | "blocked" | "not_found";
  title: string | null;
  prompt: string | null;
  endedAt: string | null;
}

// ---- Host accounts ----

/** GET /api/account: the signed-in host's live apps. `maxExpiresAt` is the furthest "keep it" can reach. */
export interface AccountAppsResponse {
  email: string;
  apps: Array<{ id: string; title: string; status: AppStatus; locale: "vi" | "en"; createdAt: string; expiresAt: string; maxExpiresAt: string }>;
}

/** GET /api/auth/session */
export interface SessionResponse {
  user: { email: string } | null;
  accountsEnabled: boolean;
}
