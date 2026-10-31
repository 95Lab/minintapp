// Fixed-window limits per bucket. Both the memory and Postgres implementations read these so
// the two backends never drift apart. Keys are composed by the callers (route handlers):
//   generate    -> ipHash
//   respond     -> participant token hash
//   respond_ip  -> `${appId}:${ipHash}` (high ceiling so a whole room on shared wifi isn't blocked)
//   report      -> participant token hash (or ipHash, caller's choice)
//   announce    -> appId (host announcements)
//   create      -> ipHash (instant apps from templates: cheap, but still rows in the DB)
//   auth_link   -> ipHash (sign-in emails: each one costs a real email)
export type RateBucket = "generate" | "create" | "respond" | "respond_ip" | "report" | "announce" | "auth_link";

export interface RateLimitConfig {
  windowSeconds: number;
  max: number;
}

export const RATE_LIMIT_CONFIG: Record<RateBucket, RateLimitConfig> = {
  generate: { windowSeconds: 600, max: 5 }, // 5 / 10 min
  create: { windowSeconds: 600, max: 30 }, // 30 / 10 min
  respond: { windowSeconds: 60, max: 30 }, // 30 / min per participant
  respond_ip: { windowSeconds: 60, max: 600 }, // 600 / min per app+IP
  report: { windowSeconds: 600, max: 5 }, // 5 / 10 min
  announce: { windowSeconds: 60, max: 6 }, // 6 / min per app
  auth_link: { windowSeconds: 600, max: 10 }, // 10 / 10 min per IP
};

/** Fixed-window boundary (ms since epoch) that `now` falls into for a given window size. */
export function windowStartMs(nowMs: number, windowSeconds: number): number {
  const windowMs = windowSeconds * 1000;
  return Math.floor(nowMs / windowMs) * windowMs;
}

/** Seconds until the current fixed window resets (minimum 1 so callers never see 0/negative). */
export function retryAfterSecondsFor(nowMs: number, windowSeconds: number): number {
  const start = windowStartMs(nowMs, windowSeconds);
  return Math.max(1, Math.ceil((start + windowSeconds * 1000 - nowMs) / 1000));
}
