import type { AppStateResponse, TemplateCreateResponse, SubmitResponseRequest } from "./api-contract-types";
export class ApiClientError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}
export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000), credentials: "same-origin", cache: "no-store" });
  const body = await response.json();
  if (!response.ok) throw new ApiClientError(response.status, typeof body.message === "string" ? body.message : "Không thể xử lý yêu cầu.");
  return body as T;
}
export const createFromTemplate = (templateId: string) => requestJson<TemplateCreateResponse>("/api/apps/from-template", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ templateId, locale: "vi", lifetime: "1h" }) });
export const createPoll = () => createFromTemplate("poll-drinks");
export function readState(id: string, host: boolean, participantToken: string | null, signal?: AbortSignal) {
  const headers: Record<string, string> = {};
  if (host) headers["x-host-view"] = "1";
  if (participantToken) headers["x-participant-token"] = participantToken;
  return requestJson<AppStateResponse>(`/api/apps/${encodeURIComponent(id)}/state`, { headers, signal });
}
export const sendVote = (id: string, body: SubmitResponseRequest) => requestJson<{ ok: true }>(`/api/apps/${encodeURIComponent(id)}/responses`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
export const changeLifecycle = (id: string, action: "close" | "reopen" | "end") => requestJson<{ ok: true }>(`/api/apps/${encodeURIComponent(id)}/lifecycle`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });

export const sendBlockAction = (id: string, blockId: string, action: string, args?: Record<string, string | number | boolean>) => requestJson<{ ok: true }>(`/api/apps/${encodeURIComponent(id)}/block-action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ blockId, action, ...(args ? { args } : {}) }) });
