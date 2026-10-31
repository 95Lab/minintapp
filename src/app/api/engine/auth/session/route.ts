import {secureRoute} from "@/engine/api/secure-route";
// /api/auth/session — the host-account session cookie (host-session.ts).
//  GET     → { user: {email} | null, accountsEnabled }   (what the header shows)
//  POST    → { code, flowId? } exchanged with the browser-bound PKCE verifier, then our cookie is set
//  DELETE  → sign out (cookie cleared)
import { NextResponse } from "next/server";
import { z } from "zod";
import { accountsEnabled } from "@/engine/config/runtime-config";
import { parseBody } from "@/engine/api/request-schemas";
import { jsonError } from "@/engine/api/route-helpers";
import { createSessionValue, readSession, sessionCookieName, SESSION_MAX_AGE_SEC } from "@/engine/auth/host-session";
import { readPkce, pkceCookieName } from "@/engine/auth/pkce-cookie";
import { checkRateLimit, clientIpHash } from "@/engine/security/security-interfaces";
import { secureHostCookie } from "@/lib/host/host-session";
import { userFromAuthCode } from "@/engine/auth/supabase-auth-clients";

const SessionRequestSchema = z.object({ code: z.string().min(8).max(4096), flowId: z.string().regex(/^[a-zA-Z0-9_-]{8,64}$/).optional() }).strict();

async function handleGET(req: Request) {
  const enabled = accountsEnabled();
  const session = enabled ? readSession(req) : null;
  return NextResponse.json({ user: session ? { email: session.email } : null, accountsEnabled: enabled }, { headers: { "cache-control": "no-store" } });
}

async function handlePOST(req: Request) {
  if (!accountsEnabled()) return jsonError(404, "accounts_disabled");
  const body = await parseBody(req, SessionRequestSchema);
  if (!body) return jsonError(400, "bad_request");
  if (!(await checkRateLimit("auth_link", clientIpHash(req))).ok) return jsonError(429, "auth_rate_limited");
  const storage = readPkce(req);
  if (!storage) return jsonError(401, "auth_link_invalid");
  const user = await userFromAuthCode(body.code, storage, body.flowId).catch(() => null);
  if (!user) return jsonError(401, "auth_link_invalid");
  const res = NextResponse.json({ ok: true, user: { email: user.email } }, { headers: { "Cache-Control": "no-store" } });
  res.cookies.set(pkceCookieName(req), "", { httpOnly: true, secure: secureHostCookie(req), sameSite: "lax", path: "/", maxAge: 0 });
  res.cookies.set(sessionCookieName(req), createSessionValue(user), {
    httpOnly: true,
    sameSite: "lax",
    // Secure in production over https (also behind a TLS-terminating proxy); an http LAN deployment still works.
    secure: secureHostCookie(req),
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  });
  return res;
}

async function handleDELETE(_req:Request) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookieName(_req), "", { httpOnly: true, secure: secureHostCookie(_req), sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}

export const GET=(...args:Parameters<typeof handleGET>)=>secureRoute(args[0],()=>handleGET(...args));

export const POST=(...args:Parameters<typeof handlePOST>)=>secureRoute(args[0],()=>handlePOST(...args));

export const DELETE=(request:Request)=>secureRoute(request,()=>handleDELETE(request));
