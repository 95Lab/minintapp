// Shared atomic fixed-window limit. Database failures stop protected writes.
import { AppError } from "@/lib/api/app-error-codes";
import { supabaseServer } from "@/engine/db/supabase-server-client";
import { logSecurityEvent } from "./log-security-event";
import { RATE_LIMIT_CONFIG, retryAfterSecondsFor, type RateBucket } from "./rate-limit-buckets";

export async function checkRateLimitPostgres(bucket: RateBucket, key: string): Promise<{ ok: boolean; retryAfterSec?: number }> {
  const { windowSeconds, max } = RATE_LIMIT_CONFIG[bucket];
  try {
    const { data, error } = await supabaseServer().rpc("minint_hit_rate_limit", {
      p_bucket: bucket,
      p_key: key,
      p_window_seconds: windowSeconds,
      p_max: max,
    });
    if (error) {
      await logSecurityEvent("rate_limit_db_error", { detail: { bucket, message: error.message } });
      throw new AppError("storage_unavailable");
    }
    if (data === true) return { ok: true };
    return { ok: false, retryAfterSec: retryAfterSecondsFor(Date.now(), windowSeconds) };
  } catch (err) {
    await logSecurityEvent("rate_limit_db_error", {
      detail: { bucket, message: err instanceof Error ? err.message : String(err) },
    });
    throw new AppError("storage_unavailable");
  }
}
