import {secureRoute} from "@/engine/api/secure-route";
// POST /api/engine/apps/[id]/responses — participant submits/updates an answer.
// Flow: app usable → rate limits (per participant, per app+IP ceiling) → validate against the
// spec → submit_response (re-checks + upsert + version bump in one round-trip) → "changed".
import { NextResponse } from "next/server";
import { parseBody, SubmitResponseRequestSchema } from "@/engine/api/request-schemas";
import { appsRepository, participantHashFor } from "@/engine/db/apps-repository";
import { broadcastAppChanged } from "@/engine/realtime/broadcast-app-changed";
import { validateResponsePayload } from "@/engine/responses/validate-response-payload";
import { checkRateLimit, clientIpHash } from "@/engine/security/security-interfaces";
import { goneBody, jsonError, loadAppState, resolveUsableApp } from "@/engine/api/route-helpers";
import { LIKE_ITEM_ID, MAX_ENTRIES_PER_PERSON, MAX_LIKES_PER_PERSON, PAID_ITEM_ID } from "@/engine/blocks/compose/compose-atoms-schema";

/**
 * Records one person may keep in a block — enforced by the store, which counts likes ("l-…") and other
 * records separately: list blocks hold up to MAX_ENTRIES_PER_PERSON lines, boards up to
 * MAX_LIKES_PER_PERSON likes. Bookkeeping records ("_join", "_paid") are not entries: they have no cap
 * and the store leaves them out of the count.
 */
function listCap(app: { spec: { blocks: Array<{ id: string; type: string; entries?: string }> } }, blockId: string, itemId: string): number | undefined {
  if (itemId.startsWith("_")) return undefined;
  if (LIKE_ITEM_ID.test(itemId)) return MAX_LIKES_PER_PERSON;
  const many = app.spec.blocks.some((b) => b.id === blockId && b.type === "compose" && b.entries === "many");
  return many ? MAX_ENTRIES_PER_PERSON : undefined;
}

async function handlePOST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const resolved = await resolveUsableApp(id);
  if ("gone" in resolved) return resolved.gone;
  const { app } = resolved;

  const body = await parseBody(req, SubmitResponseRequestSchema);
  // Settling up happens after the host closes the log: the "I've transferred" mark is the one record a closed app still takes.
  if (app.status !== "active" && !(app.status === "closed" && body?.itemId === PAID_ITEM_ID)) return jsonError(409, "app_closed");
  if (!body) return jsonError(400, "bad_request");
  const participantHash = participantHashFor(app.id, body.participantToken);
  const [perPerson, perIp] = await Promise.all([
    checkRateLimit("respond", participantHash),
    checkRateLimit("respond_ip", `${app.id}:${clientIpHash(req)}`),
  ]);
  if (!perPerson.ok || !perIp.ok) return jsonError(429, "rate_limited");

  const error = validateResponsePayload(app, body);
  // Validation errors are error codes themselves.
  if (error) return jsonError(error === "question_closed" ? 409 : 400, error);

  const outcome = await appsRepository().submitResponse(app.id, {
    blockId: body.blockId,
    itemId: body.itemId,
    participantHash,
    displayName: body.displayName?.trim().slice(0, 40) || null,
    // rebuilt by the strict schema: only known keys survive; a custom page's submission is stamped with the server clock
    payload: body.payload.kind === "custom" ? { ...body.payload, at: Date.now() } : body.payload,
  }, {
    maxRowsPerParticipant: listCap(app, body.blockId, body.itemId),
    // A removed list entry is deleted, not kept as a tombstone.
    remove: body.payload.kind === "compose" && body.payload.removed === true,
  });
  if (outcome === "gone") return NextResponse.json(goneBody(app), { status: 410 });
  if (outcome === "closed") return jsonError(409, "app_closed");
  if (outcome === "limit") return LIKE_ITEM_ID.test(body.itemId) ? jsonError(409, "likes_limit", { max: MAX_LIKES_PER_PERSON }) : jsonError(409, "entries_limit", { max: MAX_ENTRIES_PER_PERSON });

  await broadcastAppChanged(app.id, "results");
  const state = await loadAppState(app.id, req);
  return state ? NextResponse.json(state) : NextResponse.json(goneBody(null), { status: 404 });
}

export const POST=(...args:Parameters<typeof handlePOST>)=>secureRoute(args[0],()=>handlePOST(...args));
