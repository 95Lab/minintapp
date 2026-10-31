// Postgres-backed fixed-window limiter via the `hit_rate_limit` rpc (supabase/migrations/
// 20260928100000_init_schema.sql). Fails OPEN on any DB error (network blip, RPC missing, etc.)
// so a database hiccup never blocks demo traffic — the failure is logged instead.
import { supabaseServer } from "@/engine/db/supabase-server-client";
import { logSecurityEvent } from "./log-security-event";
import { RATE_LIMIT_CONFIG, retryAfterSecondsFor, type RateBucket } from "./rate-limit-buckets";

export async function checkRateLimitPostgres(bucket: RateBucket, key: string): Promise<{ ok: boolean; retryAfterSec?: number }> {
  const { windowSeconds, max } = RATE_LIMIT_CONFIG[bucket];
  try {
    const { data, error } = await supabaseServer().rpc("hit_rate_limit", {
      p_bucket: bucket,
      p_key: key,
      p_window_seconds: windowSeconds,
      p_max: max,
    });
    if (error) {
      await logSecurityEvent("rate_limit_db_error", { detail: { bucket, message: error.message } });
      return { ok: true }; // fail-open
    }
    if (data === true) return { ok: true };
    return { ok: false, retryAfterSec: retryAfterSecondsFor(Date.now(), windowSeconds) };
  } catch (err) {
    await logSecurityEvent("rate_limit_db_error", {
      detail: { bucket, message: err instanceof Error ? err.message : String(err) },
    });
    return { ok: true }; // fail-open
  }
}
