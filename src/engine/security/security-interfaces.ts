// Security facade used by the API routes. Signatures here are a frozen contract — route
// handlers (owned by another developer, refactored concurrently) call exactly these functions.
// Implementations live in the other kebab-case files in this folder; this file only delegates.
import type { AppSpec } from "@/engine/app-spec/app-spec-schema";
import { checkRateLimit as checkRateLimitImpl } from "./check-rate-limit";
import { clientIpHash as clientIpHashImpl } from "./client-ip-hash";
import { isPresenter as isPresenterImpl } from "./presenter-key-check";
import { logSecurityEvent as logSecurityEventImpl, type SecurityEventInfo } from "./log-security-event";
import { moderatePrompt as moderatePromptImpl } from "./moderate-prompt-openai";
import type { RateBucket } from "./rate-limit-buckets";
import { scanAppSpecPhishing } from "./scan-app-spec-phishing";
import { hashToken, tokenMatchesHash } from "./token-hashing";
import { looksLikePhishing } from "@/engine/generation/mock-prompt-safety-rules";

export { hashToken, tokenMatchesHash };
export type { RateBucket };

/** generate: per IP · respond: per participant · respond_ip: per app+IP (high ceiling) · report: per IP */
export async function checkRateLimit(bucket: RateBucket, key: string): Promise<{ ok: boolean; retryAfterSec?: number }> {
  return checkRateLimitImpl(bucket, key);
}

/** Salted hash of the caller's IP (first x-forwarded-for hop), never the raw IP. */
export function clientIpHash(req: Request): string {
  return clientIpHashImpl(req);
}

/** True when the request carries the team's presenter key (demo laptop, rehearsals, eval). */
export function isPresenter(req: Request): boolean {
  return isPresenterImpl(req);
}

export async function moderatePrompt(text: string): Promise<{ ok: boolean; reason?: string }> {
  return moderatePromptImpl(text);
}

/**
 * Cheap keyword pre-check run BEFORE calling the LLM: obvious credential-harvesting / bank
 * impersonation requests are refused instantly, independent of model latency or quota.
 */
export function isObviousPhishingPrompt(text: string): boolean {
  return looksLikePhishing(text);
}

export function scanAppSpec(spec: AppSpec, riskFlags: string[]): { ok: boolean; issues: string[] } {
  return scanAppSpecPhishing(spec, riskFlags);
}

export async function logSecurityEvent(kind: string, info: SecurityEventInfo): Promise<void> {
  return logSecurityEventImpl(kind, info);
}
