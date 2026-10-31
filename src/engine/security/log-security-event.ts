// Writes to `security_events` in Supabase mode; console.warn only in memory mode. Never throws
// (a logging failure must not break the request it's logging about), and never persists more
// than 500 chars of any string in `detail` (prompts, reasons, etc. get truncated first).
import { storageMode } from "@/engine/config/runtime-config";
import { supabaseServer } from "@/engine/db/supabase-server-client";

const MAX_DETAIL_STRING_LENGTH = 500;

function truncateStrings(value: unknown): unknown {
  if (typeof value === "string") {
    const safe = value.replace(/(?:sk-|sb_secret_)[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted]");
    return safe.length > MAX_DETAIL_STRING_LENGTH ? `${safe.slice(0, MAX_DETAIL_STRING_LENGTH)}…` : safe;
  }
  if (Array.isArray(value)) return value.map(truncateStrings);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, truncateStrings(v)]));
  }
  return value;
}

export interface SecurityEventInfo {
  appId?: string;
  ipHash?: string;
  detail?: Record<string, unknown>;
}

export async function logSecurityEvent(kind: string, info: SecurityEventInfo): Promise<void> {
  const safeDetail = info.detail ? (truncateStrings(info.detail) as Record<string, unknown>) : undefined;

  if (storageMode() !== "supabase") {
    console.warn("[security]", kind, { appId: info.appId, ipHash: info.ipHash, detail: safeDetail });
    return;
  }

  try {
    const { error } = await supabaseServer()
      .from("minint_security_events")
      .insert({ kind, app_id: info.appId ?? null, ip_hash: info.ipHash ?? null, detail: safeDetail ?? null });
    if (error) console.warn("[security] failed to persist security event", kind, error.message);
  } catch (err) {
    console.warn("[security] failed to persist security event", kind, err instanceof Error ? err.message : String(err));
  }
}
