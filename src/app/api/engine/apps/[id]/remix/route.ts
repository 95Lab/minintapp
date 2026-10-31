import {secureRoute} from "@/engine/api/secure-route";
import {createdResponse} from "@/engine/api/created-response";
// POST /api/engine/apps/[id]/remix (host) — current spec + results summary + instruction → child app.
// The old app is closed and points to the child via moved_to (conditional update: only one
// remix can win); participants follow it on their next state refresh.
import { NextResponse } from "next/server";
import { errorText } from "@/engine/api/app-error-codes";
import type { RemixResponse } from "@/engine/api/api-contract-types";
import { parseBody, RemixRequestSchema } from "@/engine/api/request-schemas";
import { appsRepository, isUsable } from "@/engine/db/apps-repository";
import { GENERATION_DEADLINE_MS, remixAppSpec } from "@/engine/generation/generate-app-spec";
import { broadcastAppChanged } from "@/engine/realtime/broadcast-app-changed";
import { computeResults, summarizeResultsForRemix } from "@/engine/responses/compute-results";
import { checkRateLimit, clientIpHash, isObviousPhishingPrompt, isPresenter, moderatePrompt, scanAppSpec } from "@/engine/security/security-interfaces";
import { isHostRequest, jsonError, resolveUsableApp } from "@/engine/api/route-helpers";

export const maxDuration = 30;

// Per-instance guard against double submits while the model is thinking.
const inFlight = ((globalThis as Record<string, unknown>).__minintRemixInFlight ??= new Set<string>()) as Set<string>;

async function handlePOST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const resolved = await resolveUsableApp(id);
  if ("gone" in resolved) return resolved.gone;
  const { app } = resolved;
  if (!isHostRequest(req, app)) return jsonError(403, "host_only");
  if (app.movedTo) return jsonError(409, "remix_already");
  if (inFlight.has(app.id)) return jsonError(409, "remix_busy");

  const body = await parseBody(req, RemixRequestSchema);
  if (!body) return jsonError(400, "remix_instruction_invalid");
  // Remix spends a model call like generate: same limit (unless presenter) and same moderation.
  if (!isPresenter(req)) {
    const limit = await checkRateLimit("generate", clientIpHash(req));
    if (!limit.ok) return jsonError(429, "remix_rate_limited");
  }
  const moderation = isObviousPhishingPrompt(body.instruction) ? { ok: false } : await moderatePrompt(body.instruction);
  if (!moderation.ok) {
    const res: RemixResponse = { ok: false, code: "remix_refused", message: errorText("remix_refused", "vi"), suggestion: null };
    return NextResponse.json(res, { status: 422 });
  }

  const repo = appsRepository();
  inFlight.add(app.id);
  try {
    const responses = await repo.listResponses(app.id);
    const summary = summarizeResultsForRemix(app.spec, computeResults(app, responses, { isHost: true, participantHash: null }));
    const signal = AbortSignal.any([req.signal, AbortSignal.timeout(GENERATION_DEADLINE_MS)]);
    const out = await remixAppSpec(app.spec, summary, body.instruction, { signal });
    if (out.outcome !== "ok" || !out.spec || !scanAppSpec(out.spec, out.riskFlags).ok) {
      const code = out.outcome === "refused" ? "remix_refused" : "remix_unclear";
      const res: RemixResponse = { ok: false, code, message: errorText(code, "vi"), suggestion: out.suggestion };
      return NextResponse.json(res, { status: 422 });
    }

    // Re-check after the model wait: the host may have ended the app meanwhile.
    const current = await repo.findApp(app.id);
    if (!isUsable(current) || current.movedTo) return jsonError(409, "app_ended_or_moved");

    const remaining = Math.max(60_000, current.expiresAt - Date.now());
    const { app: child, hostToken } = await repo.createApp({ spec: out.spec, prompt: `${current.prompt}\n→ ${body.instruction}`, lifetimeMs: remaining, parentId: current.id, ownerId: current.ownerId });
    if (!(await repo.markMoved(current.id, child.id))) return jsonError(409, "remix_already");
    await broadcastAppChanged(current.id, "control");
    const res: RemixResponse = { ok: true, newId: child.id, hostToken };
    return createdResponse(req,res);
  } finally {
    inFlight.delete(app.id);
  }
}

export const POST=(...args:Parameters<typeof handlePOST>)=>secureRoute(args[0],()=>handlePOST(...args));
