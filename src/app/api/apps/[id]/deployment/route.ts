import { z } from "zod";
import { AppError } from "@/lib/api/app-error-codes";
import { errorResponse } from "@/lib/api/route-helpers";
import { parseBody } from "@/lib/api/request-schemas";
import { hostTokenFrom, requireSameOrigin } from "@/lib/host/host-session";
import { verifyToken } from "@/lib/security/token-hashing";
import { deployment, pool } from "../../../../../../platform/store";
const Action = z.object({ action: z.enum(["suspend", "resume", "delete"]) });
export const runtime = "nodejs";
export async function GET(request: Request, context: RouteContext<"/api/apps/[id]/deployment">) {
  try {
    if (process.env.PLATFORM_ROLE !== "control") throw new AppError("not_found");
    const { id } = await context.params;
    if (!/^[a-f0-9]{24}$/.test(id)) throw new AppError("not_found");
    const app = await deployment(id);
    if (!app) throw new AppError("not_found");
    if (!verifyToken(hostTokenFrom(request, id), app.host_token_hash)) throw new AppError("forbidden");
    return Response.json({ state: app.state, generation: app.generation }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
export async function POST(request: Request, context: RouteContext<"/api/apps/[id]/deployment">) {
  try {
    requireSameOrigin(request);
    if (process.env.PLATFORM_ROLE !== "control") throw new AppError("not_found");
    const { id } = await context.params;
    if (!/^[a-f0-9]{24}$/.test(id)) throw new AppError("not_found");
    const app = await deployment(id);
    if (!app) throw new AppError("not_found");
    if (!verifyToken(hostTokenFrom(request, id), app.host_token_hash)) throw new AppError("forbidden");
    const input = await parseBody(request, Action);
    if (!input) throw new AppError("invalid_request");
    if (input.action === "suspend") await pool.query("UPDATE deployments SET state='SUSPENDED' WHERE id=$1 AND state='RUNNING'", [id]);
    if (input.action === "resume") await pool.query("UPDATE deployments SET state='QUEUED',queued_at=NULL,revision=revision+1 WHERE id=$1 AND state='SUSPENDED' AND expires_at>now()", [id]);
    if (input.action === "delete") await pool.query("UPDATE deployments SET expires_at=now()-interval '25 hours' WHERE id=$1", [id]);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
