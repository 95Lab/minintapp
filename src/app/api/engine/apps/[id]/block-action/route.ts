import {secureRoute} from "@/engine/api/secure-route";
// POST /api/engine/apps/[id]/block-action (host) — runs a brick's host action (quiz open/reveal, wheel
// spin/reset, …) through the registry and saves the resulting runtime atomically.
import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { BlockActionRequestSchema, parseBody } from "@/engine/api/request-schemas";
import { appsRepository } from "@/engine/db/apps-repository";
import { blockDefinition } from "@/engine/blocks/block-registry";
import { runtimePatch } from "@/engine/db/runtime-patch";
import { broadcastAppChanged } from "@/engine/realtime/broadcast-app-changed";
import { isHostRequest, jsonError, loadAppState, resolveUsableApp } from "@/engine/api/route-helpers";

/** The one host action that stays available once the app is closed. */
const SETTLE_ACTION = "confirm_paid";

/** Uniform [0,1) from the OS CSPRNG — draws must not be predictable. */
const secureRandom = () => randomInt(0, 2 ** 32) / 2 ** 32;

async function handlePOST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const resolved = await resolveUsableApp(id);
  if ("gone" in resolved) return resolved.gone;
  const { app } = resolved;
  if (!isHostRequest(req, app)) return jsonError(403, "host_only");

  const body = await parseBody(req, BlockActionRequestSchema);
  // Settling up happens after the host closes the log, so confirming received payments still works on a closed app.
  if (app.status !== "active" && !(app.status === "closed" && body?.action === SETTLE_ACTION)) return jsonError(409, "app_closed");
  const block = body ? app.spec.blocks.find((b) => b.id === body.blockId) : undefined;
  if (!body || !block) return jsonError(400, "unknown_block");
  const actions = blockDefinition(block.type).hostActions;
  // Own properties only: "__proto__" / "constructor" are not actions.
  const action = actions && Object.hasOwn(actions, body.action) ? actions[body.action] : undefined;
  if (!action) return jsonError(400, "bad_action");

  const repo = appsRepository();
  const answers = (await repo.listResponses(app.id)).filter((r) => r.blockId === block.id);
  const result = action(block, app.runtime, { args: body.args ?? {}, random: secureRandom, answers });
  if (!result.ok) return jsonError(400, result.error);

  // Write only what this action changed, so a concurrent action on other state isn't undone.
  await repo.patchRuntime(app.id, runtimePatch(app.runtime, result.runtime));
  await broadcastAppChanged(app.id, "control");
  return NextResponse.json(await loadAppState(app.id, req));
}

export const POST=(...args:Parameters<typeof handlePOST>)=>secureRoute(args[0],()=>handlePOST(...args));
