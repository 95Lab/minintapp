import { creationAvailability } from "@/lib/control-plane/creation-availability";
import { errorResponse } from "@/lib/api/route-helpers";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    return Response.json(await creationAvailability(request), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
