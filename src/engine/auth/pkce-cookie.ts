import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { signingKeyFor } from "@/engine/security/server-signing-key";
import { secureHostCookie } from "@/lib/host/host-session";
export const PKCE_MAX_AGE = 3600;
export const pkceCookieName = (req: Request) => secureHostCookie(req) ? "__Host-minint_pkce" : "minint_pkce";
const sign = (value: string) => createHmac("sha256", signingKeyFor("auth-pkce")).update(value).digest("base64url");
export function sealPkce(storage: Record<string,string>, now = Date.now()) {
  const value = Buffer.from(JSON.stringify({ storage, expires: now+PKCE_MAX_AGE*1000 })).toString("base64url");
  if (value.length > 3000) throw new Error("Auth state too large");
  return `${value}.${sign(value)}`;
}
export function readPkce(req: Request, now = Date.now()): Record<string,string> | null {
  const raw = req.headers.get("cookie")?.split(";").map(s=>s.trim()).find(s=>s.startsWith(pkceCookieName(req)+"="))?.split("=").slice(1).join("=");
  if (!raw || raw.length > 3500) return null;
  try {
    const [value, signature] = raw.split(".");
    const actual = Buffer.from(signature || ""), expected = Buffer.from(sign(value));
    if (actual.length!==expected.length || !timingSafeEqual(actual,expected)) return null;
    const payload = JSON.parse(Buffer.from(value,"base64url").toString("utf8"));
    if (payload.expires<=now || !payload.storage || Object.values(payload.storage).some(v=>typeof v!=="string")) return null;
    return payload.storage;
  } catch { return null; }
}
