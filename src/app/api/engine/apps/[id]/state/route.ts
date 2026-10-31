import {secureRoute} from "@/engine/api/secure-route";
// GET /api/engine/apps/[id]/state — the only source of truth clients act on (status, movedTo,
// quiz runtime, visible results). Realtime/polling just tells clients when to call this.
// Cheap under load: an unchanged version answers 304 without reading answers, and answers are read
// once per version for everyone (see responses-cache.ts).
import { NextResponse } from "next/server";
import { appsRepository } from "@/engine/db/apps-repository";
import { buildAppState, resolveUsableApp, stateEtag } from "@/engine/api/route-helpers";
import { STATE_REFRESH_HEADER } from "@/engine/api/api-contract-types";
import { prefetchBlocks } from "@/engine/responses/compute-results";
import { responsesForVersion } from "@/engine/responses/responses-cache";

async function handleGET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  // A refetch caused by a realtime signal must see the change that caused it: bypass the record cache.
  const resolved = await resolveUsableApp(id, { cached: req.headers.get(STATE_REFRESH_HEADER) !== "signal" });
  if ("gone" in resolved) return resolved.gone;
  const { app } = resolved;
  const etag = stateEtag(app, req);
  if (req.headers.get("if-none-match") === etag) return new NextResponse(null, { status: 304, headers: { etag, "cache-control": "no-store" } });
  const { rows, hit } = await responsesForVersion(app.id, app.stateVersion, () => appsRepository().listResponses(id));
  return NextResponse.json(buildAppState(app, rows, req, await prefetchBlocks(app.spec)), { headers: { "cache-control": "no-store", etag, "x-results-cache": hit ? "hit" : "miss" } });
}

export const GET=(...args:Parameters<typeof handleGET>)=>secureRoute(args[0],()=>handleGET(...args));
