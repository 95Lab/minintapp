import { afterEach, expect, it, vi } from "vitest";
const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("../../platform/store", () => ({ pool: { query } }));
import { GET } from "@/app/api/engine/health/route";
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it("reports Worker AI configuration without putting its key in the Control Plane response", async () => {
  vi.stubEnv("PLATFORM_ROLE", "control");
  vi.stubEnv("WORKER_AGENT_URLS", "http://worker:19090");
  vi.stubEnv("WORKER_TOKEN", "test-internal-token");
  query.mockResolvedValue({ rows: [{ agent_url: "http://untrusted:19090" }, { agent_url: "http://worker:19090" }] });
  const request = vi.fn().mockResolvedValue(Response.json({ aiConfigured: true, model: "gpt-5-mini" }));
  vi.stubGlobal("fetch", request);
  const response = await GET();
  const body = await response.json();
  expect(request).toHaveBeenCalledTimes(1);
  expect(request.mock.calls[0][0]).toBe("http://worker:19090/health");
  expect(body).toMatchObject({ storage: "postgresql", storageOk: true, generator: "openai", model: "gpt-5-mini" });
  expect(JSON.stringify(body)).not.toContain("test-internal-token");
});
it("reports unconfigured when no approved AI worker is ready", async () => {
  vi.stubEnv("PLATFORM_ROLE", "control");
  vi.stubEnv("WORKER_AGENT_URLS", "http://worker:19090");
  query.mockResolvedValue({ rows: [{ agent_url: "http://untrusted:19090" }] });
  const request = vi.fn(); vi.stubGlobal("fetch", request);
  expect(await (await GET()).json()).toMatchObject({ generator: "unconfigured", model: null });
  expect(request).not.toHaveBeenCalled();
});
