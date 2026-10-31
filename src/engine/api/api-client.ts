// Browser-side API calls. Every call sends the host/participant token header when known. Failures
// carry an error code (app-error-codes.ts) that the UI words in the app's language — never raw text.
import { STATE_REFRESH_HEADER } from "./api-contract-types";
import type { ErrorCode, ErrorParams } from "./app-error-codes";
import type {
  AppStateResponse,
  GenerateEvent,
  GenerateRequest,
  GoneResponse,
  LifecycleRequest,
  BlockActionRequest,
  TemplateCreateRequest,
  TemplateCreateResponse,
  RemixResponse,
  SubmitResponseRequest,
} from "./api-contract-types";

export type StateResult = { kind: "ok"; state: AppStateResponse } | { kind: "gone"; gone: GoneResponse } | ({ kind: "error" } & ApiFailure);

/** What a failed call knows: the server's error code (or "network" / "unknown") and its parameters. */
export interface ApiFailure {
  code: string;
  params?: ErrorParams;
}
const failure = (body: unknown, fallback: ErrorCode = "unknown"): ApiFailure => {
  const b = body as { code?: unknown; params?: ErrorParams } | null;
  return { code: typeof b?.code === "string" ? b.code : fallback, params: b?.params };
};
const NETWORK: ApiFailure = { code: "network" };

function presenterKey(): string | null {
  try {
    return localStorage.getItem("minint:presenter");
  } catch {
    return null;
  }
}

/** `host` may be null: a signed-in owner is recognised by the session cookie that rides along with every call. */
function headers(tokens: { host?: string | null; participant?: string | null }) {
  const h: Record<string, string> = { "content-type": "application/json" };
  if (tokens.host) h["x-host-token"] = tokens.host;
  // Host screens (host key present, even if null) opt in to the session cookie; phone screens never do,
  // so an owner testing their own app on the participant link still gets the participant view.
  if (tokens.host !== undefined) h["x-host-session"] = "1";
  if (tokens.participant) h["x-participant-token"] = tokens.participant;
  const pk = typeof window !== "undefined" ? presenterKey() : null;
  if (pk) h["x-presenter-key"] = pk;
  return h;
}

async function asResult(res: Response): Promise<StateResult> {
  if (res.status === 404 || res.status === 410) return { kind: "gone", gone: (await res.json()) as GoneResponse };
  const body = await res.json().catch(() => null);
  if (!res.ok) return { kind: "error", ...failure(body) };
  return { kind: "ok", state: body as AppStateResponse };
}

/** Last ETag per app+viewer: an unchanged state costs the server a 304 and no answer reads. */
const etags = new Map<string, string>();

export async function fetchState(appId: string, tokens: { host?: string | null; participant?: string | null }, opts: { fromSignal?: boolean } = {}): Promise<StateResult | { kind: "unchanged" }> {
  const key = `${appId}|${tokens.host !== undefined ? "host" : "participant"}|${tokens.host ?? ""}|${tokens.participant ?? ""}`;
  try {
    const known = opts.fromSignal ? etags.get(key) : undefined;
    const res = await fetch(`/api/engine/apps/${appId}/state`, {
      headers: { ...headers(tokens), ...(known ? { "if-none-match": known } : {}), ...(opts.fromSignal ? { [STATE_REFRESH_HEADER]: "signal" } : {}) },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (res.status === 304) return { kind: "unchanged" };
    const etag = res.headers.get("etag");
    if (etag && res.ok) etags.set(key, etag);
    return await asResult(res);
  } catch {
    return { kind: "error", ...NETWORK };
  }
}

// Mutations never throw: a dropped connection becomes an error result, so UI "busy" flags always reset.

export async function submitResponse(appId: string, body: SubmitResponseRequest): Promise<StateResult> {
  try {
    const res = await fetch(`/api/engine/apps/${appId}/responses`, { method: "POST", headers: headers({ participant: body.participantToken }), body: JSON.stringify(body) });
    return await asResult(res);
  } catch {
    return { kind: "error", ...NETWORK };
  }
}

export async function postHost<T>(appId: string, path: "block-action" | "lifecycle" | "simulate", hostToken: string | null, body?: BlockActionRequest | LifecycleRequest): Promise<{ ok: true; data: T } | ({ ok: false } & ApiFailure)> {
  try {
    const res = await fetch(`/api/engine/apps/${appId}/${path}`, { method: "POST", headers: headers({ host: hostToken }), body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => null);
    return res.ok ? { ok: true, data } : { ok: false, ...failure(data) };
  } catch {
    return { ok: false, ...NETWORK };
  }
}

export async function remixApp(appId: string, hostToken: string | null, instruction: string): Promise<RemixResponse> {
  try {
    const res = await fetch(`/api/engine/apps/${appId}/remix`, { method: "POST", headers: headers({ host: hostToken }), body: JSON.stringify({ instruction }) });
    const data = await res.json().catch(() => null);
    if (data && typeof data.ok === "boolean") return data as RemixResponse;
    return { ok: false, ...failure(data), message: "", suggestion: null };
  } catch {
    return { ok: false, ...NETWORK, message: "", suggestion: null } as RemixResponse;
  }
}

export async function createFromTemplate(req: TemplateCreateRequest): Promise<TemplateCreateResponse> {
  try {
    const res = await fetch("/api/engine/apps/from-template", { method: "POST", headers: headers({}), body: JSON.stringify(req) });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.ok) return data as TemplateCreateResponse;
    return { ok: false, ...failure(data), message: "" } as TemplateCreateResponse;
  } catch {
    return { ok: false, ...NETWORK, message: "" } as TemplateCreateResponse;
  }
}

/** Downloads every answer as CSV (host only): fetched with the host token, then saved through a blob link. */
export async function downloadExport(appId: string, hostToken: string | null): Promise<{ ok: true } | ({ ok: false } & ApiFailure)> {
  try {
    const res = await fetch(`/api/engine/apps/${appId}/export`, { headers: headers({ host: hostToken }) });
    if (!res.ok) return { ok: false, ...failure(await res.json().catch(() => null)) };
    const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? `minintapp-${appId}.csv`;
    const url = URL.createObjectURL(await res.blob());
    const link = Object.assign(document.createElement("a"), { href: url, download: name });
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return { ok: true };
  } catch {
    return { ok: false, ...NETWORK };
  }
}

/** Uploads one (already resized) photo for a block's photo input; the photo id is then submitted as the answer. */
export async function uploadPhoto(appId: string, blockId: string, participantToken: string, photo: Blob): Promise<{ photoId: string } | ApiFailure> {
  try {
    const res = await fetch(`/api/engine/apps/${appId}/photos?block=${encodeURIComponent(blockId)}`, {
      method: "POST",
      headers: { ...headers({ participant: participantToken }), "content-type": photo.type || "image/jpeg" },
      body: photo,
    });
    const data = await res.json().catch(() => null);
    return res.ok && typeof data?.photoId === "string" ? { photoId: data.photoId } : failure(data);
  } catch {
    return NETWORK;
  }
}

export async function reportApp(appId: string, participantToken: string) {
  await fetch(`/api/engine/apps/${appId}/report`, { method: "POST", headers: headers({ participant: participantToken }) }).catch(() => undefined);
}

/** Streams NDJSON progress events from POST /api/engine/generate. */
export async function generateApp(req: GenerateRequest, onEvent: (e: GenerateEvent) => void) {
  const res = await fetch("/api/engine/generate", { method: "POST", headers: headers({}), body: JSON.stringify(req) });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => null);
    onEvent({ stage: "error", ...(failure(data, "generate_failed") as { code: ErrorCode; params?: ErrorParams }), message: "" });
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) onEvent(JSON.parse(line) as GenerateEvent);
    }
  }
}
