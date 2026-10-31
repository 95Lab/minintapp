import {secureRoute} from "@/engine/api/secure-route";
// /api/auth/session — the host-account session cookie (host-session.ts).
//  GET     → { user: {email} | null, accountsEnabled }   (what the header shows)
//  POST    → { accessToken } from the magic-link redirect; verified with Supabase Auth, then our cookie is set
//  DELETE  → sign out (cookie cleared)
import { NextResponse } from "next/server";
import { z } from "zod";
import { accountsEnabled } from "@/engine/config/runtime-config";
import { parseBody } from "@/engine/api/request-schemas";
import { jsonError } from "@/engine/api/route-helpers";
import { createSessionValue, readSession, SESSION_COOKIE, SESSION_MAX_AGE_SEC } from "@/engine/auth/host-session";
import { userFromAccessToken } from "@/engine/auth/supabase-auth-clients";

const SessionRequestSchema = z.object({ accessToken: z.string().min(20).max(4096) }).strict();

async function handleGET(req: Request) {
  const enabled = accountsEnabled();
  const session = enabled ? readSession(req) : null;
  return NextResponse.json({ user: session ? { email: session.email } : null, accountsEnabled: enabled }, { headers: { "cache-control": "no-store" } });
}

async function handlePOST(req: Request) {
  if (!accountsEnabled()) return jsonError(404, "accounts_disabled");
  const body = await parseBody(req, SessionRequestSchema);
  if (!body) return jsonError(400, "bad_request");
  const user = await userFromAccessToken(body.accessToken).catch(() => null);
  if (!user) return jsonError(401, "auth_link_invalid");
  const res = NextResponse.json({ ok: true, user: { email: user.email } });
  res.cookies.set(SESSION_COOKIE, createSessionValue(user), {
    httpOnly: true,
    sameSite: "lax",
    // Secure in production over https (also behind a TLS-terminating proxy); an http LAN deployment still works.
    secure: process.env.NODE_ENV === "production" && (req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "")) === "https",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  });
  return res;
}

async function handleDELETE(_req:Request) {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}

export const GET=(...args:Parameters<typeof handleGET>)=>secureRoute(args[0],()=>handleGET(...args));

export const POST=(...args:Parameters<typeof handlePOST>)=>secureRoute(args[0],()=>handlePOST(...args));

export const DELETE=(request:Request)=>secureRoute(request,()=>handleDELETE(request));
