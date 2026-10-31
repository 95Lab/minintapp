import {secureRoute} from "@/engine/api/secure-route";
// POST /api/auth/magic-link {email} — emails a sign-in link. The answer is always {ok:true} for a valid
// address, whether or not the account exists (no way to probe who has an account); sending is rate
// limited per network because every call costs a real email.
import { NextResponse } from "next/server";
import { z } from "zod";
import { accountsEnabled } from "@/engine/config/runtime-config";
import { parseBody } from "@/engine/api/request-schemas";
import { jsonError } from "@/engine/api/route-helpers";
import { sendMagicLink } from "@/engine/auth/supabase-auth-clients";
import { checkRateLimit, clientIpHash, logSecurityEvent } from "@/engine/security/security-interfaces";

const MagicLinkRequestSchema = z.object({ email: z.string().trim().toLowerCase().max(254).pipe(z.email()) }).strict();

async function handlePOST(req: Request) {
  if (!accountsEnabled()) return jsonError(404, "accounts_disabled");
  const body = await parseBody(req, MagicLinkRequestSchema);
  if (!body) return jsonError(400, "email_invalid");

  const ipHash = clientIpHash(req);
  const limit = await checkRateLimit("auth_link", ipHash);
  if (!limit.ok) return jsonError(429, "auth_rate_limited", { minutes: Math.ceil((limit.retryAfterSec ?? 60) / 60) });

  // The browser sends its own origin; Supabase refuses redirect URLs that are not on its allow-list.
  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  const { error } = await sendMagicLink(body.email, `${origin}/auth/callback`);
  // Failures (provider email limits, SMTP down) are logged, never shown: the reply must not differ per address.
  if (error) await logSecurityEvent("magic_link_failed", { ipHash, detail: { message: error } });
  return NextResponse.json({ ok: true });
}

export const POST=(...args:Parameters<typeof handlePOST>)=>secureRoute(args[0],()=>handlePOST(...args));
