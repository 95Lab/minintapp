// Storage contract shared by the in-memory and Supabase implementations. Routes only talk to
// this interface, so switching storage is an environment change, not a code change.
import type { AppSpec } from "@/engine/app-spec/app-spec-schema";
import type { AppStatus, ResponsePayload } from "@/engine/api/api-contract-types";
import { hashToken } from "@/engine/security/token-hashing";
import type { Payee } from "@/engine/money/payee";

import type { AppRuntime } from "@/engine/blocks/block-definition-types";
import type { RuntimePatch } from "./runtime-patch";

/** Quiz fields + per-brick slots (`blocks[blockId]`, e.g. wheel spins). Stored as runtime_state jsonb. */
export type QuizRuntime = AppRuntime;

export interface AppRecord {
  id: string;
  spec: AppSpec;
  prompt: string;
  parentId: string | null;
  movedTo: string | null;
  hostTokenHash: string;
  status: AppStatus;
  runtime: QuizRuntime;
  stateVersion: number;
  reportCount: number;
  createdAt: number;
  expiresAt: number;
  endedAt: number | null;
  /** The host's one-line message to everyone (null = none); `at` is epoch ms. */
  announcement: Announcement | null;
  /** Where a settle-up view's QR sends money; set by the host only (null = none). */
  payee: Payee | null;
  /** Supabase Auth user who owns the app (host control from any device); null = anonymous, host token only. */
  ownerId: string | null;
}

export interface Announcement {
  text: string;
  at: number;
}

export interface ResponseRecord {
  blockId: string;
  itemId: string;
  participantHash: string;
  displayName: string | null;
  payload: ResponsePayload;
  createdAt: number;
}

export type SubmitOutcome = "ok" | "gone" | "closed" | "limit";

/** A participant's uploaded photo (photo input). */
export interface PhotoRecord {
  id: string;
  participantHash: string;
  mime: string;
  bytes: Uint8Array;
}
export interface PhotoCaps {
  perPerson: number;
  perApp: number;
}

export interface SubmitOptions {
  /** list blocks: refuse a NEW record once the participant has this many in the block */
  maxRowsPerParticipant?: number;
  /** delete the record instead of storing it (list entry removed by its author) */
  remove?: boolean;
}

export interface AppsRepository {
  createApp(input: { spec: AppSpec; prompt: string; lifetimeMs: number; parentId?: string | null; ownerId?: string | null }): Promise<{ app: AppRecord; hostToken: string }>;
  /** Makes `userId` the owner only while the app has none (a claim never takes over an owned app). */
  setOwner(appId: string, userId: string): Promise<boolean>;
  /** Apps owned by `userId` that still take reads (not ended/expired), newest first. */
  listAppsByOwner(userId: string): Promise<AppRecord[]>;
  /** Any status; null when it never existed or was purged. */
  findApp(id: string): Promise<AppRecord | null>;
  listResponses(appId: string): Promise<ResponseRecord[]>;
  /** Re-checks the app is usable, upserts (one record per block/item/participant) or deletes, bumps stateVersion. */
  submitResponse(appId: string, r: Omit<ResponseRecord, "createdAt">, opts?: SubmitOptions): Promise<SubmitOutcome>;
  /** Merges a host action's runtime changes atomically (see runtime-patch.ts) and bumps stateVersion. */
  patchRuntime(appId: string, patch: RuntimePatch): Promise<void>;
  /** Patches status/runtime and bumps stateVersion. */
  updateApp(appId: string, patch: Partial<Pick<AppRecord, "status" | "runtime">>): Promise<void>;
  /** Sets moved_to + closes the app only if it has not moved yet. Returns false when it already moved. */
  markMoved(appId: string, toId: string): Promise<boolean>;
  /** Pushes expiry later (only later; only while the app is alive). Returns false when nothing changed. */
  extendApp(appId: string, untilMs: number): Promise<boolean>;
  /** Sets or clears (null) the announcement and bumps stateVersion. False when the app is ended, blocked or expired. */
  setAnnouncement(appId: string, value: Announcement | null): Promise<boolean>;
  /** Sets or clears (null) the payee and bumps stateVersion. False when the app is ended, blocked or expired. */
  setPayee(appId: string, value: Payee | null): Promise<boolean>;
  /** Deletes all answers (and the payee) immediately and marks the app ended. */
  endApp(appId: string): Promise<void>;
  /**
   * Records one report per reporter; blocks the app once reporters come from `threshold` distinct
   * networks (IP hashes). Returns the number of distinct networks that reported.
   */
  addReport(appId: string, reporterHash: string, ipHash: string, threshold: number): Promise<number>;
  /** Stores a photo while the app takes answers and the caps allow ("limit" otherwise). */
  addPhoto(appId: string, photo: PhotoRecord, caps: PhotoCaps): Promise<SubmitOutcome>;
  getPhoto(appId: string, photoId: string): Promise<{ mime: string; bytes: Uint8Array } | null>;
}

/** "Keep it as long as you want" — within reason: an app lives at most this long after it was created. */
export const MAX_APP_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

/** A signed-in host may keep an app they own this long after it was created. */
export const MAX_OWNED_APP_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;

/** The lifetime ceiling that applies to this app: 90 days when owned, else 30. */
export const maxLifetimeMs = (app: Pick<AppRecord, "ownerId">) => (app.ownerId ? MAX_OWNED_APP_LIFETIME_MS : MAX_APP_LIFETIME_MS);

/** Expired apps are hard-deleted this long after expiry (cleanup job / in-memory purge). */
export const PURGE_AFTER_MS = 10 * 60 * 1000;

export const isExpired = (app: AppRecord, now = Date.now()) => app.status === "ended" || app.expiresAt <= now;

/** Only apps that still accept reads/writes: not expired, not ended, not blocked. */
export const isUsable = (app: AppRecord | null): app is AppRecord => !!app && !isExpired(app) && app.status !== "blocked";

export { participantHashFor } from "@/lib/security/token-hashing";
