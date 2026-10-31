import type { AppStateResponse, TemplateCreateResponse, SubmitResponseRequest, GenerateRequest, GenerateResponse } from "./api-contract-types";
export class ApiClientError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}
export async function requestJson<T>(path: string, init?: RequestInit, timeoutMs = 10_000): Promise<T> {
  const response = await fetch(path, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs), credentials: "same-origin", cache: "no-store" });
  const body = await response.json();
  if (!response.ok) throw new ApiClientError(response.status, typeof body.message === "string" ? body.message : "Không thể xử lý yêu cầu.");
  return body as T;
}
export const createFromTemplate = async (templateId: string) => {
  await requestJson("/api/session", { method: "POST" });
  return awaitProvisioned(await requestJson<TemplateCreateResponse>("/api/apps/from-template", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ templateId, locale: "vi", lifetime: "1h" }) }));
};
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

export const createGeneratedApp = async (input: GenerateRequest) => {
  await requestJson("/api/session", { method: "POST" });
  return awaitProvisioned(await requestJson<GenerateResponse>("/api/generate", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify(input) }, 310_000));
};

export async function awaitProvisioned<T extends { ok: boolean }>(result: T): Promise<T> {
  if (!result.ok || !("deploymentState" in result)) return result;
  if (!("id" in result) || typeof result.id !== "string") throw new ApiClientError(502, "Invalid deployment response");
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    const status = await requestJson<{ state: string; generation?: unknown }>(`/api/apps/${result.id}/deployment`, { headers: "hostToken" in result && typeof result.hostToken === "string" ? { "x-host-token": result.hostToken } : {} });
    if (status.state === "RUNNING") return { ...result, ...(status.generation ? { generation: status.generation } : {}) } as T;
    if (["FAILED", "EXPIRED", "DELETED"].includes(status.state)) throw new ApiClientError(502, "Không thể triển khai ứng dụng. Xem trạng thái trong dashboard.");
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new ApiClientError(503, "Ứng dụng vẫn đang triển khai. Xem trạng thái trong dashboard.");
}
