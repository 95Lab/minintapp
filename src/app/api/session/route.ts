import { NextResponse } from "next/server";
import { tenantIdentity } from "@/lib/control-plane/deployments";
import { requireSameOrigin, secureHostCookie } from "@/lib/host/host-session";
import { errorResponse } from "@/lib/api/route-helpers";
import { AppError } from "@/lib/api/app-error-codes";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    if (process.env.PLATFORM_ROLE === "runtime") throw new AppError("forbidden");
    const tenant = tenantIdentity(request);
    const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(tenant.cookieName, tenant.token, { httpOnly: true, sameSite: "strict", secure: secureHostCookie(request), path: "/", maxAge: 30 * 86400 });
    return response;
  } catch (error) { return errorResponse(error); }
}
