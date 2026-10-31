import { managedAppResponse } from "@/lib/control-plane/managed-app-response";
import {secureRoute} from "@/engine/api/secure-route";
import {createdResponse} from "@/engine/api/created-response";
// POST /api/engine/apps/from-template — creates an app from a ready-made template instantly (no LLM call).
// The host can then remix it in words.
import { NextResponse } from "next/server";
import { LIFETIME_MS, type TemplateCreateResponse } from "@/engine/api/api-contract-types";
import { parseBody, TemplateCreateRequestSchema } from "@/engine/api/request-schemas";
import { AppSpecSchema } from "@/engine/app-spec/app-spec-schema";
import { appsRepository } from "@/engine/db/apps-repository";
import { findTemplate } from "@/engine/templates/app-templates";
import { checkRateLimit, clientIpHash, isPresenter } from "@/engine/security/security-interfaces";
import { jsonError } from "@/engine/api/route-helpers";
import { readSession } from "@/engine/auth/host-session";

async function handlePOST(req: Request) {
  if (process.env.PLATFORM_ROLE === "runtime") return Response.json({ ok: false, code: "forbidden" }, { status: 403 });
  const body = await parseBody(req, TemplateCreateRequestSchema);
  const template = body ? findTemplate(body.templateId) : undefined;
  if (!body || !template) return jsonError(400, "template_not_found");

  if (!isPresenter(req)) {
    const limit = await checkRateLimit("create", clientIpHash(req));
    if (!limit.ok) return jsonError(429, "create_rate_limited", { minutes: Math.ceil((limit.retryAfterSec ?? 60) / 60) });
  }

  const spec = AppSpecSchema.parse(template.spec[body.locale]);
  if (process.env.PLATFORM_ROLE === "control") return managedAppResponse(req, { spec, prompt: template.title[body.locale], lifetime: body.lifetime, engine: true, ownerId: readSession(req)?.userId });
  const { app, hostToken } = await appsRepository().createApp({ spec, prompt: template.title[body.locale], lifetimeMs: LIFETIME_MS[body.lifetime], ownerId: readSession(req)?.userId });
  const res: TemplateCreateResponse = { ok: true, id: app.id, hostToken };
  return createdResponse(req,res);
}

export const POST=(...args:Parameters<typeof handlePOST>)=>secureRoute(args[0],()=>handlePOST(...args));
