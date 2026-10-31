import { afterEach, expect, it, vi } from "vitest";
import { composeSpec } from "@/lib/app-spec/app-spec-examples";
import { appsRepository } from "@/lib/db/apps-repository";
const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));
vi.mock("@/lib/generation/providers/openai-client", async () => {
  const { default: OpenAI } = await import("openai");
  return { createOpenAIClient: () => new OpenAI({ apiKey: "test-only", maxRetries: 0, fetch: fetchMock }) };
});
import { POST } from "@/app/api/generate/route";
afterEach(() => vi.unstubAllEnvs());
it("runs the actual SDK parser and generate route against a stubbed HTTP response", async () => {
  vi.stubEnv("OPENAI_API_KEY", "test-only");
  vi.stubEnv("OPENAI_MODEL", "gpt-5-mini");
  fetchMock.mockResolvedValue(Response.json({
    id: "resp_test", object: "response", created_at: 1, status: "completed",
    output: [{ type: "message", id: "msg_test", role: "assistant", status: "completed", content: [{ type: "output_text", text: JSON.stringify(composeSpec()), annotations: [] }] }],
  }));
  const response = await POST(new Request("http://local/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: "Bình chọn đồ uống" }) }));
  expect(response.status).toBe(201);
  const body = await response.json();
  expect(body.generation).toMatchObject({ provider: "openai", attempts: 1, repaired: false });
  expect((await appsRepository.findApp(body.id))?.spec).toEqual(composeSpec());
  const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(requestBody).toMatchObject({ store: false, text: { format: { type: "json_schema", strict: true, name: "app_spec" } } });
});
