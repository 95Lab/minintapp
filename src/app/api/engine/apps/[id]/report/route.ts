import {secureRoute} from "@/engine/api/secure-route";
// POST /api/engine/apps/[id]/report — participant flags an abusive app. Counted once per participant
// token; the app is auto-blocked only when reports come from 3 DISTINCT networks (IP hashes), so
// one heckler — or one shared venue Wi-Fi — can't take down a live app. The host can always end it.
import { NextResponse } from "next/server";
import { appsRepository, participantHashFor } from "@/engine/db/apps-repository";
import { broadcastAppChanged } from "@/engine/realtime/broadcast-app-changed";
import { checkRateLimit, clientIpHash, logSecurityEvent } from "@/engine/security/security-interfaces";
import { jsonError, PARTICIPANT_TOKEN_HEADER, resolveUsableApp } from "@/engine/api/route-helpers";

const BLOCK_THRESHOLD = 3;

async function handlePOST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const resolved = await resolveUsableApp(id);
  if ("gone" in resolved) return resolved.gone;
  const { app } = resolved;
  const token = req.headers.get(PARTICIPANT_TOKEN_HEADER);
  if (!token || !/^[A-Za-z0-9_-]{16,64}$/.test(token)) return jsonError(400, "reporter_missing");
  const ipHash = clientIpHash(req);
  const limit = await checkRateLimit("report", ipHash);
  if (!limit.ok) return jsonError(429, "already_reported");

  const count = await appsRepository().addReport(app.id, participantHashFor(app.id, token), ipHash, BLOCK_THRESHOLD);
  await logSecurityEvent(count >= BLOCK_THRESHOLD ? "app_blocked" : "app_reported", { appId: app.id, ipHash, detail: { count } });
  await broadcastAppChanged(app.id, "control");
  return NextResponse.json({ ok: true });
}

export const POST=(...args:Parameters<typeof handlePOST>)=>secureRoute(args[0],()=>handlePOST(...args));
