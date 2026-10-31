import { afterEach, beforeEach, expect, it, vi } from "vitest";
const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("../../platform/store", () => ({ pool: { query }, countOwnedDeployments: vi.fn(async () => 0) }));
vi.mock("@/engine/security/check-rate-limit", () => ({ checkRateLimit: vi.fn(async () => ({ ok: true })) }));
import { POST } from "@/app/api/engine/plan/route";
const reply = { status: "clarify", message: "Mấy câu hỏi?", suggestions: [], brief: null };
const plan = () => POST(new Request("http://local/api/engine/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locale: "vi", messages: [{ role: "user", content: "Quiz an toàn thông tin" }], currentBrief: null }) }));
beforeEach(() => {
  vi.stubEnv("PLATFORM_ROLE", "control");
  vi.stubEnv("OPENAI_API_KEY", "");
  vi.stubEnv("WORKER_AGENT_URLS", "http://worker:19090");
  vi.stubEnv("WORKER_TOKEN", "test-internal-token");
  vi.stubEnv("DATABASE_URL", "postgresql://test@localhost/test");
  vi.stubEnv("REDIS_URL", "redis://localhost:6379");
  vi.stubEnv("RUNTIME_IMAGE", `ghcr.io/95lab/minintapp@sha256:${"a".repeat(64)}`);
  vi.stubEnv("APPS_DOMAIN", "apps.example.test");
  vi.stubEnv("GENERATION_MAX_PER_HOUR", "1000");
  query.mockResolvedValue({ rows: [{ agent_url: "http://untrusted:19090" }, { agent_url: "http://worker:19090" }] });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it("plans on an approved Worker because the Control Plane has no OpenAI key", async () => {
  const request = vi.fn().mockResolvedValue(Response.json(reply));
  vi.stubGlobal("fetch", request);
  const response = await plan();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(reply);
  expect(request).toHaveBeenCalledTimes(1);
  expect(request.mock.calls[0][0]).toBe("http://worker:19090/plan");
  expect(request.mock.calls[0][1].headers.Authorization).toBe("Bearer test-internal-token");
});
it("keeps the Worker's error code and rejects a malformed Worker reply", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ code: "ai_refused" }, { status: 422 })));
  expect((await plan()).status).toBe(422);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ status: "ready", message: "ok", suggestions: [], brief: null })));
  expect((await plan()).status).toBe(502);
});
it("reports the runtime unavailable when no approved Worker is ready", async () => {
  query.mockResolvedValue({ rows: [{ agent_url: "http://untrusted:19090" }] });
  const request = vi.fn(); vi.stubGlobal("fetch", request);
  expect((await plan()).status).toBe(503);
  expect(request).not.toHaveBeenCalled();
});
