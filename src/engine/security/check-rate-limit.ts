// Dispatches to the memory or Postgres backend based on storageMode(), so callers (route
// handlers) never need to know which one is active.
import { storageMode } from "@/engine/config/runtime-config";
import { checkRateLimitMemory } from "./rate-limit-memory-store";
import { checkRateLimitPostgres } from "./rate-limit-postgres-store";
import type { RateBucket } from "./rate-limit-buckets";

export async function checkRateLimit(bucket: RateBucket, key: string): Promise<{ ok: boolean; retryAfterSec?: number }> {
  return storageMode() === "memory" ? checkRateLimitMemory(bucket, key) : checkRateLimitPostgres(bucket, key);
}
