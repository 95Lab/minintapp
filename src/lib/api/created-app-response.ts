import "server-only";
import { NextResponse } from "next/server";
import type { AppRecord } from "@/lib/db/apps-repository-types";
import type { GenerationMeta } from "@/lib/generation/llm-output-types";
import { hostCookieName, secureHostCookie } from "@/lib/host/host-session";
export function createdAppResponse(request: Request, app: Pick<AppRecord, "id" | "expiresAt">, hostToken: string, generation?: GenerationMeta, pending = false) {
  const response = NextResponse.json({ ok: true, id: app.id, hostToken, ...(generation ? { generation } : {}), ...(pending ? { deploymentState: "QUEUED" } : {}) }, { status: pending ? 202 : 201, headers: { "Cache-Control": "no-store" } });
  response.cookies.set(hostCookieName(app.id), hostToken, { httpOnly: true, sameSite: "lax", secure: secureHostCookie(request), path: `/api/apps/${app.id}`, maxAge: Math.max(1, Math.ceil((app.expiresAt - Date.now()) / 1000)) });
  return response;
}
