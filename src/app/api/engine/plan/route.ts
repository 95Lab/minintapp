import { PlanningRequestSchema } from "@/lib/api/planning-contract";
import { parseBody } from "@/lib/api/request-schemas";
import { AppError } from "@/lib/api/app-error-codes";
import { errorResponse } from "@/lib/api/route-helpers";
import { requireSameOrigin } from "@/lib/host/host-session";
import { readRuntimeConfig } from "@/lib/config/runtime-config";
import { generationBudget } from "@/lib/generation/generation-budget";
import { planApp } from "@/lib/generation/plan-app";
import { checkRateLimit } from "@/engine/security/check-rate-limit";
import { clientIpHash } from "@/engine/security/client-ip-hash";

export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(request: Request) {
  let release: (() => void) | undefined;
  let locale: "vi" | "en" = "vi";
  try {
    requireSameOrigin(request);
    if (process.env.PLATFORM_ROLE === "runtime") throw new AppError("forbidden");
    const input = await parseBody(request, PlanningRequestSchema);
    if (!input) throw new AppError("invalid_request");
    locale = input.locale;
    const config = readRuntimeConfig();
    if (!config.OPENAI_API_KEY) throw new AppError("ai_not_configured");
    if (!(await checkRateLimit("plan", clientIpHash(request))).ok) throw new AppError("rate_limited");
    release = generationBudget.acquire(config.GENERATION_MAX_PER_HOUR, config.GENERATION_MAX_CONCURRENT);
    const result = await planApp(input, request.signal);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error, locale); }
  finally { release?.(); }
}
