import {secureRoute} from "@/engine/api/secure-route";
import {hostTokenFrom} from "@/lib/host/host-session";
// POST /api/account/claim {apps: [{id, hostToken}]} — "save to my account". Each app is claimed only
// when its host token matches (proof of control) and it has no owner yet, so a claim can never take an
// app from its owner or from someone who only guessed an id. Answers which ids are now the caller's.
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody } from "@/engine/api/request-schemas";
import { jsonError } from "@/engine/api/route-helpers";
import { readSession } from "@/engine/auth/host-session";
import { appsRepository, isUsable } from "@/engine/db/apps-repository";
import { tokenMatchesHash } from "@/engine/security/security-interfaces";

const MAX_CLAIMS = 50;
const ClaimRequestSchema = z
  .object({ apps: z.array(z.object({ id: z.string().min(1).max(40), hostToken: z.string().max(100) }).strict()).max(MAX_CLAIMS) })
  .strict();

async function handlePOST(req: Request) {
  const session = readSession(req);
  if (!session) return jsonError(401, "sign_in_required");
  const body = await parseBody(req, ClaimRequestSchema);
  if (!body) return jsonError(400, "bad_request");

  const repo = appsRepository();
  const claimed: string[] = [];
  for (const { id, hostToken } of body.apps) {
    const app = await repo.findApp(id);
    if (!isUsable(app) || !tokenMatchesHash(hostToken || hostTokenFrom(req,id), app.hostTokenHash)) continue;
    // Already mine (a repeated claim) counts as claimed; someone else's does not.
    if (app.ownerId === session.userId || (!app.ownerId && (await repo.setOwner(id, session.userId)))) claimed.push(id);
  }
  return NextResponse.json({ ok: true, claimed });
}

export const POST=(...args:Parameters<typeof handlePOST>)=>secureRoute(args[0],()=>handlePOST(...args));
