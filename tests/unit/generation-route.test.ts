import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { composeSpec } from "@/lib/app-spec/app-spec-examples";
import { AppError } from "@/lib/api/app-error-codes";
import { appsRepository } from "@/lib/db/apps-repository";
const { generate } = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@/lib/generation/generate-app-spec", () => ({ generateAppSpec: generate }));
import { POST } from "@/app/api/generate/route";
const request = (body: unknown, headers: Record<string, string> = {}) => new Request("http://local/api/generate", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
const generated = () => ({ spec: composeSpec(), generation: { provider: "openai", model: "test-model", durationMs: 1, attempts: 1, repaired: false } });
beforeEach(() => { generate.mockReset(); vi.stubEnv("OPENAI_API_KEY", "test-key-never-send"); vi.stubEnv("GENERATION_MAX_PER_HOUR", "1000"); vi.stubEnv("GENERATION_MAX_CONCURRENT", "2"); });
afterEach(() => vi.unstubAllEnvs());
describe("POST /api/generate", () => {
  it("validates, persists, sets the host cookie and returns a usable app", async () => {
    generate.mockResolvedValue(generated());
    const response = await POST(request({ prompt: "  Bình chọn đồ uống  ", lifetime: "24h" }));
    expect(response.status).toBe(201);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body.generation.provider).toBe("openai");
    const app = await appsRepository.findApp(body.id);
    expect(app?.prompt).toBe("Bình chọn đồ uống");
    expect(app!.expiresAt - app!.createdAt).toBe(86_400_000);
    expect(body).not.toHaveProperty("hostTokenHash");
    expect(JSON.stringify(body)).not.toContain("test-key-never-send");
  });
  it("rejects invalid input and cross-origin calls before invoking the provider", async () => {
    expect((await POST(request({ prompt: "" }))).status).toBe(400);
    expect((await POST(request({ prompt: "vote" }, { Origin: "http://other" }))).status).toBe(403);
    expect(generate).not.toHaveBeenCalled();
  });
  it("reports missing configuration without a mock fallback", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const response = await POST(request({ prompt: "vote" }));
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("ai_not_configured");
    expect(generate).not.toHaveBeenCalled();
  });
  it("does not persist an unsupported compose result even if an adapter returns it", async () => {
    const result = generated();
    const block = result.spec.blocks[0]; if (block.type !== "compose") throw Error();
    block.inputs[0].kind = "text";
    generate.mockResolvedValue(result);
    const create = vi.spyOn(appsRepository, "createApp");
    const response = await POST(request({ prompt: "a text form" }));
    expect(response.status).toBe(502);
    expect(create).not.toHaveBeenCalled(); create.mockRestore();
  });
  it("sanitizes provider failures and releases its concurrency slot", async () => {
    vi.stubEnv("GENERATION_MAX_CONCURRENT", "1");
    generate.mockRejectedValueOnce(new Error("secret-provider-key"));
    const response = await POST(request({ prompt: "vote" }));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("secret-provider-key");
    generate.mockResolvedValueOnce(generated());
    expect((await POST(request({ prompt: "vote again" }))).status).toBe(201);
  });
  it("refuses a second in-flight generation and releases when the first finishes", async () => {
    vi.stubEnv("GENERATION_MAX_CONCURRENT", "1");
    let finish!: (result: ReturnType<typeof generated>) => void;
    generate.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const pending = POST(request({ prompt: "one" }));
    await vi.waitFor(() => expect(generate).toHaveBeenCalledTimes(1));
    const blocked = await POST(request({ prompt: "two" }));
    expect(blocked.status).toBe(429);
    finish(generated());
    expect((await pending).status).toBe(201);
  });
  it("returns refusal without creating an app", async () => {
    generate.mockRejectedValue(new AppError("ai_refused"));
    expect((await POST(request({ prompt: "refused request" }))).status).toBe(422);
  });
});
