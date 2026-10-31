import "server-only";
import { createManagedApp } from "./deployments";
import { createdAppResponse } from "@/lib/api/created-app-response";
import { secureHostCookie, engineHostCookieName } from "@/lib/host/host-session";
export async function managedAppResponse(request: Request, input: Parameters<typeof createManagedApp>[1]) {
  const result = await createManagedApp(request, input);
  const response = createdAppResponse(request, { id: result.id, expiresAt: result.deployed.expires_at.getTime() }, result.hostToken, undefined, true);
  response.cookies.set(result.tenant.cookieName, result.tenant.token, { httpOnly: true, sameSite: "strict", secure: secureHostCookie(request), path: "/", maxAge: 30 * 86400 });
  response.cookies.set(engineHostCookieName(result.id), result.hostToken, { httpOnly: true, sameSite: "lax", secure: secureHostCookie(request), path: "/api/engine", maxAge: Math.max(1, Math.ceil((result.deployed.expires_at.getTime()-Date.now())/1000)) });
  return response;
}
