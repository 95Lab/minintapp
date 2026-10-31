import {secureRoute} from "@/engine/api/secure-route";
// GET /api/account — the signed-in host's apps ("My apps"). 401 without a session.
import { NextResponse } from "next/server";
import type { AccountAppsResponse } from "@/engine/api/api-contract-types";
import { jsonError } from "@/engine/api/route-helpers";
import { readSession } from "@/engine/auth/host-session";
import { appsRepository, maxLifetimeMs } from "@/engine/db/apps-repository";

async function handleGET(req: Request) {
  const session = readSession(req);
  if (!session) return jsonError(401, "sign_in_required");
  const apps = await appsRepository().listAppsByOwner(session.userId);
  const res: AccountAppsResponse = {
    email: session.email,
    apps: apps.map((a) => ({
      id: a.id,
      title: a.spec.title,
      status: a.status,
      locale: a.spec.locale,
      createdAt: new Date(a.createdAt).toISOString(),
      expiresAt: new Date(a.expiresAt).toISOString(),
      maxExpiresAt: new Date(a.createdAt + maxLifetimeMs(a)).toISOString(),
    })),
  };
  return NextResponse.json(res, { headers: { "cache-control": "no-store" } });
}

export const GET=(...args:Parameters<typeof handleGET>)=>secureRoute(args[0],()=>handleGET(...args));
