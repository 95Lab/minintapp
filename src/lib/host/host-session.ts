import "server-only";
import { readRuntimeConfig } from "@/lib/config/runtime-config";
import { AppError } from "@/lib/api/app-error-codes";
import { verifyToken } from "@/lib/security/token-hashing";
import type { AppRecord } from "@/lib/db/apps-repository-types";
export const hostCookieName = (id: string) => `minint_host_${id}`;
export function hostTokenFrom(request: Request, id: string) {
  const explicit = request.headers.get("x-host-token");
  if (explicit) return explicit;
  const cookie = (request.headers.get("cookie") ?? "").split(";").map((s) => s.trim()).find((s) => s.startsWith(`${hostCookieName(id)}=`));
  return cookie?.slice(cookie.indexOf("=") + 1) ?? "";
}
export function requireHost(request: Request, app: AppRecord) {
  const token = hostTokenFrom(request, app.id);
  if (!verifyToken(token, app.hostTokenHash)) throw new AppError("forbidden");
  return token;
}
export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return; // Non-browser API clients may omit Origin; host credentials are still required.
  try {
    const source = new URL(origin);
    const configured = readRuntimeConfig().APP_ORIGIN;
    if (configured) {
      if (source.origin !== configured || source.origin !== origin) throw new Error();
      return;
    }
    // Next's internal request URL may use the listen hostname (0.0.0.0).
    // The HTTP Host header identifies the origin actually addressed by the browser.
    const host = request.headers.get("host") ?? new URL(request.url).host;
    if (!["http:", "https:"].includes(source.protocol) || source.host !== host || source.origin !== origin) throw new Error();
  } catch { throw new AppError("forbidden"); }
}

export function secureHostCookie(request: Request) {
  const configured = readRuntimeConfig().APP_ORIGIN;
  return new URL(configured || request.url).protocol === "https:";
}
