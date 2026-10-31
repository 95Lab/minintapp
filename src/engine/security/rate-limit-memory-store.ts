// In-memory fixed-window rate limiter, used when storageMode() === "memory" (no Supabase env).
// A single process-wide Map is fine for the hackathon deployment target (one Next.js instance);
// it resets on restart, same tradeoff as the rest of the in-memory store.
import { RATE_LIMIT_CONFIG, retryAfterSecondsFor, windowStartMs, type RateBucket } from "./rate-limit-buckets";

interface CounterEntry {
  windowStart: number;
  count: number;
}

const counters = new Map<string, CounterEntry>();

export function checkRateLimitMemory(bucket: RateBucket, key: string): { ok: boolean; retryAfterSec?: number } {
  const { windowSeconds, max } = RATE_LIMIT_CONFIG[bucket];
  const now = Date.now();
  const currentWindowStart = windowStartMs(now, windowSeconds);
  const mapKey = `${bucket}:${key}`;
  const existing = counters.get(mapKey);
  const count = existing && existing.windowStart === currentWindowStart ? existing.count + 1 : 1;
  counters.set(mapKey, { windowStart: currentWindowStart, count });

  if (count <= max) return { ok: true };
  return { ok: false, retryAfterSec: retryAfterSecondsFor(now, windowSeconds) };
}

/** Test-only: clears every counter so unit tests start from a clean window. */
export function resetRateLimitMemoryStoreForTests(): void {
  counters.clear();
}
