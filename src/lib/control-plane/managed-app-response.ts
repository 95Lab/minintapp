import "server-only";
import { createManagedApp } from "./deployments";
import { createdAppResponse } from "@/lib/api/created-app-response";
import { secureHostCookie } from "@/lib/host/host-session";
export async function managedAppResponse(request: Request, input: Parameters<typeof createManagedApp>[1]) {
  const result = await createManagedApp(request, input);
  const response = createdAppResponse(request, { id: result.id, expiresAt: result.deployed.expires_at.getTime() }, result.hostToken, undefined, true);
  response.cookies.set(result.tenant.cookieName, result.tenant.token, { httpOnly: true, sameSite: "strict", secure: secureHostCookie(request), path: "/", maxAge: 30 * 86400 });
  return response;
}
