// Host account session: our own signed cookie, issued after Supabase Auth has verified an email
// magic link. Supabase tokens never reach the browser's storage; the cookie only says "this email owns
// these apps" and is useless without the server-side key. Value = base64url("userId.email.expiresAtMs")
// + "." + HMAC-SHA256 of that part. Read synchronously from the Cookie header of any Request.
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { signingKeyFor } from "@/engine/security/server-signing-key";

export const SESSION_COOKIE = "minint_session";
export const SESSION_MAX_AGE_SEC = 30 * 24 * 60 * 60;

export interface HostSession {
  userId: string;
  email: string;
}

const sign = (payload: string) => createHmac("sha256", signingKeyFor("session")).update(payload).digest("base64url");

/** Cookie value for a verified user; `now` is injectable for tests. */
export function createSessionValue(user: HostSession, now = Date.now()): string {
  const payload = Buffer.from(`${user.userId}.${user.email}.${now + SESSION_MAX_AGE_SEC * 1000}`).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function cookieValue(req: Request, name: string): string | null {
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const eq = part.indexOf("=");
    if (eq > 0 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

/** The signed-in host of this request, or null (no cookie, tampered, or expired). */
export function readSession(req: Request, now = Date.now()): HostSession | null {
  const value = cookieValue(req, SESSION_COOKIE);
  const dot = value?.indexOf(".") ?? -1;
  if (!value || dot < 1) return null;
  const payload = value.slice(0, dot);
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(value.slice(dot + 1));
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  // userId is a uuid (no dots) and expiry is digits; the email in between may contain dots.
  const m = /^([0-9a-f-]{36})\.(.+)\.(\d+)$/.exec(Buffer.from(payload, "base64url").toString("utf8"));
  if (!m || Number(m[3]) <= now) return null;
  return { userId: m[1], email: m[2] };
}
