import { NextResponse } from "next/server";
import { parseBody, TemplateCreateRequestSchema } from "@/lib/api/request-schemas";
import { errorResponse } from "@/lib/api/route-helpers";
import { AppError } from "@/lib/api/app-error-codes";
import { appsRepository } from "@/lib/db/apps-repository";
import { templateSpec } from "@/lib/templates/app-templates";
import { LIFETIME_MS } from "@/lib/api/api-contract-types";
import { hostCookieName, requireSameOrigin, secureHostCookie } from "@/lib/host/host-session";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const input = await parseBody(request, TemplateCreateRequestSchema);
    if (!input) throw new AppError("invalid_request");
    const spec = templateSpec(input.templateId, input.locale);
    const { app, hostToken } = await appsRepository.createApp({ spec, prompt: spec.title, lifetimeMs: LIFETIME_MS[input.lifetime] });
    const response = NextResponse.json({ ok: true, id: app.id, hostToken }, { status: 201, headers: { "Cache-Control": "no-store" } });
    response.cookies.set(hostCookieName(app.id), hostToken, { httpOnly: true, sameSite: "lax", secure: secureHostCookie(request), path: `/api/apps/${app.id}`, maxAge: LIFETIME_MS[input.lifetime] / 1000 });
    return response;
  } catch (error) { return errorResponse(error); }
}
