import { GenerateRequestSchema, parseBody } from "@/lib/api/request-schemas";
import { AppError } from "@/lib/api/app-error-codes";
import { errorResponse } from "@/lib/api/route-helpers";
import { createdAppResponse } from "@/lib/api/created-app-response";
import { LIFETIME_MS } from "@/lib/api/api-contract-types";
import { readRuntimeConfig } from "@/lib/config/runtime-config";
import { requireSameOrigin } from "@/lib/host/host-session";
import { appsRepository } from "@/lib/db/apps-repository";
import { generateAppSpec } from "@/lib/generation/generate-app-spec";
import { validateRunnableSpec } from "@/lib/generation/runnable-spec";
import { generationBudget } from "@/lib/generation/generation-budget";
import { managedAppResponse } from "@/lib/control-plane/managed-app-response";
export const runtime = "nodejs";
export async function POST(request: Request) {
  let release: (() => void) | undefined;
  try {
    requireSameOrigin(request);
    if (process.env.PLATFORM_ROLE === "runtime") throw new AppError("forbidden");
    const input = await parseBody(request, GenerateRequestSchema);
    if (!input) throw new AppError("invalid_request");
    if(input.subdomain&&process.env.PLATFORM_ROLE!=="control")throw new AppError("runtime_unavailable");
    if (process.env.PLATFORM_ROLE === "control") return await managedAppResponse(request, input);
    const config = readRuntimeConfig();
    if (!config.OPENAI_API_KEY) throw new AppError("ai_not_configured");
    release = generationBudget.acquire(config.GENERATION_MAX_PER_HOUR, config.GENERATION_MAX_CONCURRENT);
    const result = await generateAppSpec(input, { signal: request.signal });
    request.signal.throwIfAborted();
    const validated = validateRunnableSpec(result.spec);
    if (!validated.spec) throw new AppError("ai_invalid_output");
    const { app, hostToken } = await appsRepository.createApp({ spec: validated.spec, prompt: input.prompt, lifetimeMs: LIFETIME_MS[input.lifetime] });
    return createdAppResponse(request, app, hostToken, result.generation);
  } catch (error) { return errorResponse(error); }
  finally { release?.(); }
}
