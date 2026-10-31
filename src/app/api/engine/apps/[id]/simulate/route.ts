import {secureRoute} from "@/engine/api/secure-route";
// POST /api/engine/apps/[id]/simulate (host, PREVIEW/REHEARSAL ONLY) — adds a few sample participants so
// the host view can be reviewed on one machine. Each brick supplies its own sample answer.
// Disabled in production unless ENABLE_SIMULATE=1. Names are prefixed "Mẫu" so they never pass as real people.
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { runtimeConfig } from "@/engine/config/runtime-config";
import { appsRepository, participantHashFor } from "@/engine/db/apps-repository";
import { blockDefinition } from "@/engine/blocks/block-registry";
import { broadcastAppChanged } from "@/engine/realtime/broadcast-app-changed";
import { isHostRequest, jsonError, resolveUsableApp } from "@/engine/api/route-helpers";

const NAMES = ["An", "Bình", "Chi", "Dũng", "Giang", "Hà", "Khoa", "Linh", "Minh", "Ngọc", "Phúc", "Quân", "Thảo", "Vy"];

async function handlePOST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!runtimeConfig.simulateEnabled) return jsonError(404, "not_found");
  const { id } = await ctx.params;
  const resolved = await resolveUsableApp(id);
  if ("gone" in resolved) return resolved.gone;
  const { app } = resolved;
  if (!isHostRequest(req, app)) return jsonError(403, "host_only");
  if (app.status !== "active") return jsonError(409, "app_closed");

  const repo = appsRepository();
  const count = 3 + Math.floor(Math.random() * 4);
  for (let i = 0; i < count; i++) {
    const participantHash = participantHashFor(app.id, nanoid(24));
    const displayName = `Mẫu · ${NAMES[Math.floor(Math.random() * NAMES.length)]}`;
    for (const block of app.spec.blocks) {
      const sample = blockDefinition(block.type).sampleAnswer?.(block, app.runtime, Math.random);
      if (sample) await repo.submitResponse(app.id, { blockId: block.id, itemId: sample.itemId, participantHash, displayName, payload: sample.payload });
    }
  }
  await broadcastAppChanged(app.id, "results");
  return NextResponse.json({ ok: true, added: count });
}

export const POST=(...args:Parameters<typeof handlePOST>)=>secureRoute(args[0],()=>handlePOST(...args));
