import "server-only";
import { readRuntimeConfig } from "@/lib/config/runtime-config";
import { appsRepository } from "@/lib/db/apps-repository";
import { isUsable } from "@/lib/db/apps-repository-types";
import { stripPrivateFields } from "@/lib/app-spec/strip-private-fields";
import { AppError } from "./app-error-codes";
import type { AppStateResponse } from "./api-contract-types";
import { computeResults } from "@/lib/responses/compute-results";
import { participantHashFor } from "@/lib/security/token-hashing";
import { requireHost } from "@/lib/host/host-session";
export async function requireApp(id: string) {
  if (!/^[a-f0-9]{24}$/.test(id)) throw new AppError("not_found");
  const app = await appsRepository.findApp(id);
  if (!app) throw new AppError("not_found");
  if (!isUsable(app)) throw new AppError("app_gone");
  return app;
}
export async function readAppState(request: Request, id: string): Promise<AppStateResponse> {
  if (!/^[a-f0-9]{24}$/.test(id)) throw new AppError("not_found");
  const snapshot = await appsRepository.snapshot(id);
  if (!snapshot) throw new AppError("not_found");
  const app = snapshot.app;
  if (!isUsable(app)) throw new AppError("app_gone");
  const isHost = request.headers.get("x-host-view") === "1";
  if (isHost) requireHost(request, app);
  const token = request.headers.get("x-participant-token");
  if (token && !/^[A-Za-z0-9_-]{16,64}$/.test(token)) throw new AppError("invalid_request");
  const hash = token ? participantHashFor(id, token) : null;
  const rows = snapshot.responses;
  const myRows = hash ? rows.filter((r) => r.participantHash === hash) : [];
  const results = computeResults(app.spec, rows, app.runtime, isHost).filter((result) => {
    if (!("kind" in result)) return true;
    const block = app.spec.blocks.find((b) => b.id === result.blockId);
    const view = block?.type === "compose" ? block.views.find((v) => v.id === result.viewId) : null;
    const done = app.runtime.blocks[result.blockId]?.step?.done ?? [];
    const afterStep = block?.type === "compose" && block.flow === "steps" && (view?.source ? done.includes(view.source) : block.inputs.every((i) => done.includes(i.id)));
    return (view?.visibleTo === "after_step" && afterStep) || isHost || view?.visibleTo === "everyone" || (view?.visibleTo === "after_submit" && myRows.some((r) => r.blockId === result.blockId)) || (view?.visibleTo === "after_close" && app.status === "closed");
  });
  const env = readRuntimeConfig();
  return {
    sync: env.APP_STORAGE === "supabase" && app.realtimeChannel ? { mode: "supabase", url: env.NEXT_PUBLIC_SUPABASE_URL, publicKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, channel: `app:${app.realtimeChannel}` } : { mode: "memory" },
    id, status: app.status, expiresAt: new Date(app.expiresAt).toISOString(), stateVersion: app.stateVersion,
    spec: stripPrivateFields(app.spec, app.runtime), runtime: app.runtime, isHost,
    participantCount: new Set(rows.map((r) => r.participantHash)).size, results,
    myAnswers: Object.fromEntries(myRows.map((r) => [`${r.blockId}:${r.itemId}`, r.payload])),
  };
}
export const noStoreJson = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store", Vary: "Cookie, x-host-view, x-host-token, x-participant-token" } });
