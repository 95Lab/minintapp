import { timingSafeEqual, createHash } from "node:crypto";
import { appsRepository } from "@/lib/db/apps-repository";
import { RuntimeRPCSchema } from "@/lib/runtime-plane/rpc";
import { parseBody } from "@/lib/api/request-schemas";
import { AppError } from "@/lib/api/app-error-codes";
import { errorResponse } from "@/lib/api/route-helpers";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const expected = process.env.RUNTIME_TOKEN;
    const actual = request.headers.get("authorization")?.replace(/^Bearer /, "");
    if (process.env.PLATFORM_ROLE !== "runtime" || !expected || !actual || !timingSafeEqual(createHash("sha256").update(expected).digest(), createHash("sha256").update(actual).digest())) throw new AppError("not_found");
    const input = await parseBody(request, RuntimeRPCSchema);
    const id = process.env.RUNTIME_APP_ID!;
    if (!input) throw new AppError("invalid_request");
    let result;
    switch (input.op) {
      case "snapshot": result = await appsRepository.snapshot(id); break;
      case "listResponses": result = await appsRepository.listResponses(id); break;
      case "submitResponse": result = await appsRepository.submitResponse(id, input.args[0]); break;
      case "blockAction": result = await appsRepository.blockAction(id, ...input.args); break;
      case "transition": result = await appsRepository.transition(id, ...input.args); break;
    }
    return Response.json({ result: result ?? null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
