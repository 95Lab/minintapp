import { managedAppResponse } from "@/lib/control-plane/managed-app-response";
import {checkRateLimit,clientIpHash} from "@/engine/security/security-interfaces";
import { createdAppResponse } from "@/lib/api/created-app-response";
import { parseBody, TemplateCreateRequestSchema } from "@/lib/api/request-schemas";
import { errorResponse } from "@/lib/api/route-helpers";
import { AppError } from "@/lib/api/app-error-codes";
import { appsRepository } from "@/lib/db/apps-repository";
import { templateSpec } from "@/lib/templates/app-templates";
import { LIFETIME_MS } from "@/lib/api/api-contract-types";
import { requireSameOrigin } from "@/lib/host/host-session";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    if (process.env.PLATFORM_ROLE === "runtime") throw new AppError("forbidden");
    if(!(await checkRateLimit("create",clientIpHash(request))).ok)throw new AppError("rate_limited");
    const input = await parseBody(request, TemplateCreateRequestSchema);
    if (!input) throw new AppError("invalid_request");
    const spec = templateSpec(input.templateId, input.locale);
    if (process.env.PLATFORM_ROLE === "control") return await managedAppResponse(request, { spec, prompt: spec.title, lifetime: input.lifetime });
    const { app, hostToken } = await appsRepository.createApp({ spec, prompt: spec.title, lifetimeMs: LIFETIME_MS[input.lifetime] });
    return createdAppResponse(request, app, hostToken);
  } catch (error) { return errorResponse(error); }
}
