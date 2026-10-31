import { requireSameOrigin } from "@/lib/host/host-session";
import { errorResponse } from "@/lib/api/route-helpers";
export async function secureRoute(request: Request, run: () => Promise<Response>) {
  try {
    if (!["GET", "HEAD"].includes(request.method)) requireSameOrigin(request);
    return await run();
  } catch (error) { return errorResponse(error); }
}
