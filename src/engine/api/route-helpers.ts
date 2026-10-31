import {runtimeConfig} from "@/engine/config/runtime-config";
// Helpers shared by route handlers: token headers, JSON errors, "gone" responses,
// and building the single state document every client reads.
import { NextResponse } from "next/server";
import { errorText, type ErrorCode, type ErrorParams } from "@/engine/api/app-error-codes";
import type { AppStateResponse, GoneResponse } from "@/engine/api/api-contract-types";
import { stripPrivateFields, type PublicAppSpec } from "@/engine/app-spec/strip-private-fields";
import { appsRepository, isUsable, participantHashFor, type AppRecord, type ResponseRecord } from "@/engine/db/apps-repository";
import { liveEtagBucket } from "@/engine/live-data/live-data-loader";
import { computeResults, myAnswers, participantCount, prefetchBlocks } from "@/engine/responses/compute-results";
import { publicPayee } from "@/engine/money/payee";
import { tokenMatchesHash } from "@/engine/security/security-interfaces";
import { responsesForVersion } from "@/engine/responses/responses-cache";
import { findAppCached } from "@/engine/db/app-record-cache";
import {hostTokenFrom} from "@/lib/host/host-session";
import { readSession } from "@/engine/auth/host-session";

export const HOST_TOKEN_HEADER = "x-host-token";
export const HOST_SESSION_HEADER = "x-host-session";
export const PARTICIPANT_TOKEN_HEADER = "x-participant-token";

/** Remixed apps store "original\n→ instruction…"; public pages only ever show the original request. */
export const originalPrompt = (prompt: string) => prompt.split("\n→")[0];

/**
 * Error response: a code the client translates (app-error-codes.ts). `message` (Vietnamese) stays for
 * older clients and logs; UIs show `errorText(code, locale, params)` instead.
 */
export const jsonError = (status: number, code: ErrorCode, params?: ErrorParams) =>
  NextResponse.json({ ok: false, code, params, message: errorText(code, "vi", params) }, { status });

/**
 * Host = holds the app's host token, or is signed in as the account that owns it (any device). The
 * session counts only on calls that opt in with `x-host-session` (host screens do, phone screens don't),
 * so an owner opening their own participant link sees what participants see.
 */
export function isHostRequest(req: Request, app: AppRecord) {
  const credential=req.headers.get(HOST_TOKEN_HEADER) || (req.headers.get(HOST_SESSION_HEADER)==="1" ? hostTokenFrom(req,app.id) : null);
  if (tokenMatchesHash(credential, app.hostTokenHash)) return true;
  const session = app.ownerId && req.headers.get(HOST_SESSION_HEADER) === "1" ? readSession(req) : null;
  return !!session && session.userId === app.ownerId;
}

export function goneBody(app: AppRecord | null): GoneResponse {
  if (!app) return { gone: true, reason: "not_found", title: null, prompt: null, endedAt: null };
  return {
    gone: true,
    reason: app.status === "blocked" ? "blocked" : app.status === "ended" ? "ended" : "expired",
    title: app.spec.title,
    prompt: app.status === "blocked" ? null : originalPrompt(app.prompt),
    endedAt: new Date(app.endedAt ?? app.expiresAt).toISOString(),
  };
}

/**
 * Loads an app that can still be used, or a 404/410 response explaining why it is gone.
 * `cached`: allow a record up to ~300 ms old (hot polling path only — writes always read fresh).
 */
export async function resolveUsableApp(id: string, opts: { cached?: boolean } = {}): Promise<{ app: AppRecord } | { gone: NextResponse }> {
  const app = opts.cached ? await findAppCached(appsRepository(), id) : await appsRepository().findApp(id);
  if (isUsable(app)) return { app };
  return { gone: NextResponse.json(goneBody(app), { status: app ? 410 : 404 }) };
}

/** `prefetched`: async data for bricks that need it (see prefetchBlocks); omit for none. */
export function buildAppState(app: AppRecord, responses: ResponseRecord[], req: Request, prefetched: Record<string, unknown> = {}): AppStateResponse {
  const isHost = isHostRequest(req, app);
  const token = req.headers.get(PARTICIPANT_TOKEN_HEADER);
  const participantHash = token ? participantHashFor(app.id, token) : null;
  // The host made the app and knows its answers: only participants get the stripped copy.
  const spec: PublicAppSpec = isHost ? app.spec : stripPrivateFields(app.spec, new Set(app.runtime.revealedQuestionIds));
  const results = computeResults(app, responses, { isHost, participantHash }, prefetched);
  const hasSettleView = (r: (typeof results)[number]) => r?.type === "compose" && r.views.some((v) => v.kind === "settle");
  return {
    id: app.id,
    status: app.status,
    movedTo: app.movedTo,
    expiresAt: new Date(app.expiresAt).toISOString(),
    endedAt: app.endedAt ? new Date(app.endedAt).toISOString() : null,
    stateVersion: app.stateVersion,
    announcement: app.announcement,
    // The bank details only go to a viewer who can actually see a settle view (the host always can).
    payee: isHost || results.some(hasSettleView) ? publicPayee(app.payee) : null,
    // Participants don't need the host's wording (it may include remix instructions).
    prompt: isHost ? app.prompt : "",
    spec,
    runtime: { openQuestionId: app.runtime.openQuestionId, revealedQuestionIds: [...app.runtime.revealedQuestionIds] },
    results,
    participantCount: participantCount(responses),
    isHost,
    myAnswers: myAnswers(responses, participantHash),
    sync: (app as AppRecord & {realtimeChannel?:string}).realtimeChannel ? {mode:"supabase",url:runtimeConfig.supabaseUrl,publicKey:runtimeConfig.supabaseAnonKey,channel:`app:${(app as AppRecord & {realtimeChannel?:string}).realtimeChannel}`} : {mode:"memory"},
  };
}

/**
 * Identifies one caller's view of one state version: same version + same viewer ⇒ same document.
 * (Every write bumps the version; the viewer part keeps one participant's cached copy from another's.)
 * An app with a live block also changes with time, since its data refreshes without any write.
 */
export function stateEtag(app: AppRecord, req: Request): string {
  const token = req.headers.get(PARTICIPANT_TOKEN_HEADER);
  const viewer = isHostRequest(req, app) ? "host" : token ? participantHashFor(app.id, token).slice(0, 16) : "anon";
  const live = app.spec.blocks.some((b) => b.type === "live") ? `-t${liveEtagBucket()}` : "";
  return `W/"${app.id}-${app.stateVersion}-${viewer}${live}"`;
}

/** Fresh app + responses → state document for this caller (after a write). */
export async function loadAppState(appId: string, req: Request): Promise<AppStateResponse | null> {
  const {appsRepository:base}=await import("@/lib/db/apps-repository");
  const snapshot=await base.snapshot(appId);if(!snapshot)return null;
  const app=snapshot.app as unknown as AppRecord;
  return buildAppState(app,snapshot.responses as unknown as ResponseRecord[],req,await prefetchBlocks(app.spec));
}
