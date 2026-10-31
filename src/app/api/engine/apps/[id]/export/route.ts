import {secureRoute} from "@/engine/api/secure-route";
// GET /api/engine/apps/[id]/export (header x-host-token) — every answer as a CSV, for the host to keep after
// the app disappears. Host only: the file holds participants' names and answers.
import { jsonError, isHostRequest, resolveUsableApp } from "@/engine/api/route-helpers";
import { appsRepository } from "@/engine/db/apps-repository";
import { exportResponsesCsv } from "@/engine/responses/export-responses-csv";

async function handleGET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const resolved = await resolveUsableApp(id);
  if ("gone" in resolved) return resolved.gone;
  const { app } = resolved;
  if (!isHostRequest(req, app)) return jsonError(403, "host_only");
  const csv = exportResponsesCsv(app.spec, await appsRepository().listResponses(app.id));
  const name = `minintapp-${app.id}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "no-store",
    },
  });
}

export const GET=(...args:Parameters<typeof handleGET>)=>secureRoute(args[0],()=>handleGET(...args));
