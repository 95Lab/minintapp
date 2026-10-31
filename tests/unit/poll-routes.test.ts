import { describe, expect, it } from "vitest";
import { POST as create } from "@/app/api/apps/from-template/route";
import { GET as state } from "@/app/api/apps/[id]/state/route";
import { POST as submit } from "@/app/api/apps/[id]/responses/route";
import { POST as lifecycle } from "@/app/api/apps/[id]/lifecycle/route";
import { parseBody, GenerateRequestSchema } from "@/lib/api/request-schemas";
import { appsRepository } from "@/lib/db/apps-repository";
const request = (path: string, body?: unknown, headers: Record<string, string> = {}) => new Request(`http://local${path}`, { method: body === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json", ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const context = (id: string) => ({ params: Promise.resolve({ id }) });
async function newApp() {
  const response = await create(request("/api/apps/from-template", { templateId: "poll-drinks", locale: "vi", lifetime: "1h" }));
  expect(response.status).toBe(201);
  expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  return response.json() as Promise<{ id: string; hostToken: string }>;
}
const vote = (participantToken = "a".repeat(64)) => ({ blockId: "poll", itemId: "", participantToken, displayName: null, payload: { kind: "compose", values: { drink: "tea" } } });
describe("poll API", () => {
  it("creates, accepts a vote and exposes only safe viewer-specific state", async () => {
    const { id, hostToken } = await newApp();
    expect((await submit(request(`/api/apps/${id}/responses`, vote()), context(id))).status).toBe(200);
    const response = await state(request(`/api/apps/${id}/state`, undefined, { "x-participant-token": "a".repeat(64) }), context(id));
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body.participantCount).toBe(1);
    expect(body.results[0].items[0].count).toBe(1);
    expect(body.myAnswers["poll:"]).toEqual(vote().payload);
    expect(JSON.stringify(body)).not.toMatch(/hostToken|participantHash|ownerId/);
    const publicState = await (await state(request(`/api/apps/${id}/state`), context(id))).json();
    expect(publicState.myAnswers).toEqual({});
    const host = await state(request(`/api/apps/${id}/state`, undefined, { "x-host-view": "1", "x-host-token": hostToken }), context(id));
    expect((await host.json()).isHost).toBe(true);
  });
  it("blocks unauthorized and cross-app host access and lifecycle changes", async () => {
    const first = await newApp(); const second = await newApp();
    expect((await state(request(`/api/apps/${second.id}/state`, undefined, { "x-host-view": "1", "x-host-token": first.hostToken }), context(second.id))).status).toBe(403);
    expect((await lifecycle(request(`/api/apps/${first.id}/lifecycle`, { action: "close" }), context(first.id))).status).toBe(403);
    const headers = { "x-host-token": first.hostToken };
    expect((await lifecycle(request(`/api/apps/${first.id}/lifecycle`, { action: "close" }, headers), context(first.id))).status).toBe(200);
    expect((await submit(request(`/api/apps/${first.id}/responses`, vote()), context(first.id))).status).toBe(409);
    expect((await lifecycle(request(`/api/apps/${first.id}/lifecycle`, { action: "end" }, headers), context(first.id))).status).toBe(200);
    expect((await state(request(`/api/apps/${first.id}/state`), context(first.id))).status).toBe(410);
    expect(await appsRepository.listResponses(first.id)).toHaveLength(0);
  });
  it("rejects cross-origin mutations, unknown templates, malformed payloads and oversized bodies", async () => {
    expect((await create(request("/api/apps/from-template", { templateId: "poll-drinks" }, { origin: "http://foreign" }))).status).toBe(403);
    // Next may construct an internal URL using its bind address; Host is the browser-facing host.
    expect((await create(request("/api/apps/from-template", { templateId: "poll-drinks" }, { origin: "http://127.0.0.1:3100", host: "127.0.0.1:3100" }))).status).toBe(201);
    expect((await create(request("/api/apps/from-template", { templateId: "unknown" }))).status).toBe(404);
    const { id } = await newApp();
    expect((await submit(request(`/api/apps/${id}/responses`, { ...vote(), payload: { kind: "compose", values: { drink: "bad" } } }), context(id))).status).toBe(400);
    expect((await submit(request(`/api/apps/${id}/responses`, { ...vote(), hostToken: "extra" }), context(id))).status).toBe(400);
    expect(await parseBody(request("/", { prompt: "x".repeat(17000) }), GenerateRequestSchema)).toBeNull();
    expect((await state(request("/api/apps/bad/state"), context("bad"))).status).toBe(404);
  });
});
