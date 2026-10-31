// Single source of truth for the Content-Security-Policy (Next 16 renamed middleware.ts ->
// proxy.ts; the exported function runs on the Node.js runtime by default — see
// https://nextjs.org/docs/app/api-reference/file-conventions/proxy).
//
// A fresh nonce is generated per request and placed on BOTH the outgoing request's
// `Content-Security-Policy` header (Next reads this during rendering to attach the nonce to its
// own framework/page scripts — see https://nextjs.org/docs/app/guides/content-security-policy)
// and the `x-nonce` header (so Server Components can read it via `headers()` for any custom
// inline `<Script>` tags). The RESPONSE header name switches to `Content-Security-Policy-Report-Only`
// when CSP_REPORT_ONLY=1, so the policy can be rolled out without breaking the app first; only
// `frame-src 'self'` stays enforced then (it contains the sandboxed pages of `custom` blocks).
//
// All non-CSP security headers (nosniff, Referrer-Policy, Permissions-Policy, X-Frame-Options,
// HSTS) live in next.config.ts instead — this file only ever sets CSP.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const NONCE_HEADER = "x-nonce";
const CSP_HEADER = "Content-Security-Policy";
const CSP_REPORT_ONLY_HEADER = "Content-Security-Policy-Report-Only";

/** The part of the policy that stays enforced even with CSP_REPORT_ONLY=1 (it is what contains custom pages). */
const ENFORCED_WHEN_REPORT_ONLY = "frame-src 'self'";

export interface CspBuildOptions {
  nonce: string;
  isDev: boolean;
  /** NEXT_PUBLIC_SUPABASE_URL, e.g. "http://127.0.0.1:54421" or "https://xyz.supabase.co". May be "". */
  supabaseUrl: string;
}

/** Derives the http(s) origin and matching ws(s) origin from a Supabase URL, best-effort. */
function supabaseConnectOrigins(supabaseUrl: string): string[] {
  if (!supabaseUrl) return [];
  try {
    const url = new URL(supabaseUrl);
    const httpOrigin = `${url.protocol}//${url.host}`;
    const wsProtocol = url.protocol === "https:" ? "wss:" : "ws:";
    const wsOrigin = `${wsProtocol}//${url.host}`;
    return [httpOrigin, wsOrigin];
  } catch {
    return [];
  }
}

/**
 * Pure builder — no request/response objects — so the exact CSP string can be unit tested
 * (tests/unit/security-csp-builder.test.ts) without going through the proxy runtime.
 */
export function buildContentSecurityPolicy({ nonce, isDev, supabaseUrl }: CspBuildOptions): string {
  const scriptSrc = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
  if (isDev) scriptSrc.push("'unsafe-eval'");

  const connectSrc = ["'self'", ...supabaseConnectOrigins(supabaseUrl)];
  if (isDev) connectSrc.push("ws://localhost:*", "ws://127.0.0.1:*");

  const directives: Array<[string, string[]]> = [
    ["default-src", ["'self'"]],
    ["script-src", scriptSrc],
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["img-src", ["'self'", "data:", "blob:", "https://tile.openstreetmap.org"]],
    ["font-src", ["'self'", "data:"]],
    // sandboxed pages of `custom` blocks (/sandbox/…) are framed by the app screens
    ["frame-src", ["'self'"]],
    ["connect-src", connectSrc],
    ["frame-ancestors", ["'none'"]],
    ["form-action", ["'self'"]],
    ["base-uri", ["'none'"]],
    ["object-src", ["'none'"]],
  ];

  return directives.map(([directive, values]) => `${directive} ${values.join(" ")}`).join("; ");
}

export function proxy(request: NextRequest) {
  let runtimeTarget: URL | undefined;
  if (process.env.PLATFORM_ROLE === "runtime") {
    if (["/dashboard", "/preview", "/templates", "/login", "/my-apps"].some((path) => request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(path + "/"))) return new NextResponse("Not found", { status: 404 });
    const id = process.env.RUNTIME_APP_ID;
    if (request.nextUrl.pathname === "/" && id && /^[a-f0-9]{24}$/.test(id)) {
      runtimeTarget = new URL(request.url); runtimeTarget.pathname = `/rooms/${id}`;
    }
  }
  // The sandbox route sets its own, much stricter CSP (no network, inline script only); a nonce CSP
  // here would be a second policy on the same response and only ever make it more permissive to reason about.
  if (request.nextUrl.pathname.startsWith("/sandbox/")) return NextResponse.next();
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV !== "production";
  const csp = buildContentSecurityPolicy({ nonce, isDev, supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "" });

  // Next only looks for the (non-report-only) `Content-Security-Policy` request header to
  // extract the nonce, regardless of whether the browser-facing policy is report-only.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(NONCE_HEADER, nonce);
  requestHeaders.set(CSP_HEADER, csp);

  const response = runtimeTarget ? NextResponse.rewrite(runtimeTarget, { request: { headers: requestHeaders } }) : NextResponse.next({ request: { headers: requestHeaders } });
  if (process.env.CSP_REPORT_ONLY === "1") {
    response.headers.set(CSP_REPORT_ONLY_HEADER, csp);
    // Report-only must not loosen where a sandboxed page can be framed from: keep that one directive enforced.
    response.headers.set(CSP_HEADER, ENFORCED_WHEN_REPORT_ONLY);
  } else {
    response.headers.set(CSP_HEADER, csp);
  }
  return response;
}

export default proxy;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
