import { readAppState, noStoreJson } from "@/lib/api/poll-service";
import { errorResponse } from "@/lib/api/route-helpers";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: RouteContext<"/api/apps/[id]/state">) {
  try { const { id } = await context.params; return noStoreJson(await readAppState(request, id)); }
  catch (error) { return errorResponse(error); }
}
