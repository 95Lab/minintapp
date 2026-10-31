import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { fetchMock, limit } = vi.hoisted(() => ({ fetchMock: vi.fn(), limit: vi.fn() }));
vi.mock("@/lib/generation/providers/openai-client", async () => {
  const { default: OpenAI } = await import("openai");
  return { createOpenAIClient: () => new OpenAI({ apiKey: "test-only", maxRetries: 0, fetch: fetchMock }) };
});
vi.mock("@/engine/security/check-rate-limit", () => ({ checkRateLimit: limit }));
import { POST } from "@/app/api/engine/plan/route";
import { PlanningReplySchema } from "@/lib/api/planning-contract";

const input = () => ({ locale: "vi", messages: [{ role: "user", content: "Bình chọn đồ uống" }], currentBrief: null });
const request = (body: unknown, origin?: string) => new Request("http://local/api/engine/plan", { method: "POST", headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify(body) });
const reply = () => ({ status: "ready", message: "Đã đủ thông tin. Hãy xác nhận bản yêu cầu.", suggestions: [], brief: "Bình chọn trà hoặc cà phê, mỗi người một phiếu." });
function response(value: unknown, status = "completed") {
  return Response.json({ id: "resp_test", object: "response", created_at: 1, status, output: [{ type: "message", id: "msg_test", role: "assistant", status: "completed", content: [{ type: "output_text", text: JSON.stringify(value), annotations: [] }] }] });
}
beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "test-only");
  vi.stubEnv("GENERATION_MAX_PER_HOUR", "1000");
  vi.stubEnv("GENERATION_MAX_CONCURRENT", "2");
  fetchMock.mockReset(); limit.mockReset(); limit.mockResolvedValue({ ok: true });
});
afterEach(() => vi.unstubAllEnvs());

describe("planning route and actual SDK parser (mocked HTTP)", () => {
  it("returns a validated brief without provisioning or granting host credentials", async () => {
    fetchMock.mockResolvedValue(response(reply()));
    const res = await POST(request(input()));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(await res.json()).toEqual(reply());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({ store: false, max_output_tokens: 2500, text: { format: { type: "json_schema", name: "app_planning", strict: true } } });
    expect(JSON.parse(body.input)).toEqual({ ...input(), questionsLeft: 5 });
    expect(limit).toHaveBeenCalledWith("plan", expect.any(String));
  });
  const fiveAnswered = () => Array.from({ length: 11 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: i ? `Lượt ${i}` : "Tạo app cho team" }));
  it("closes the conversation itself once five questions were asked", async () => {
    fetchMock.mockResolvedValue(response({ status: "clarify", message: "Câu thứ sáu?", suggestions: ["A"], brief: "Bình chọn cho team" }));
    const body = await (await POST(request({ ...input(), messages: fiveAnswered() }))).json();
    expect(body).toMatchObject({ status: "ready", brief: "Bình chọn cho team", suggestions: [] });
    expect(body.message).toContain("Chốt yêu cầu và tạo app");
    expect(JSON.parse(JSON.parse(fetchMock.mock.calls[0][1].body).input).questionsLeft).toBe(0);
  });
  it("builds a brief from the conversation when the model has none at the limit", async () => {
    fetchMock.mockResolvedValue(response({ status: "clarify", message: "Câu thứ sáu?", suggestions: [], brief: null }));
    expect((await (await POST(request({ ...input(), messages: fiveAnswered() }))).json()).brief).toContain("Tạo app cho team");
  });
  it("never turns a refusal into a ready brief at the limit", async () => {
    fetchMock.mockResolvedValue(response({ status: "unsupported", message: "Không hỗ trợ.", suggestions: [], brief: null }));
    expect(await (await POST(request({ ...input(), messages: fiveAnswered() }))).json()).toMatchObject({ status: "unsupported", brief: null });
  });
  it("includes previous answers and the current brief when asking the next question", async () => {
    const value = { ...input(), lifetime: "24h", useDefaults: true, currentBrief: "Bình chọn trà", messages: [{ role: "user", content: "Bình chọn đồ uống" }, { role: "assistant", content: "Chọn một hay nhiều?" }, { role: "user", content: "Nhiều, ẩn kết quả đến khi chốt" }] };
    fetchMock.mockResolvedValue(response({ status: "clarify", message: "Các đồ uống gồm những gì?", suggestions: ["Trà và cà phê"], brief: "Chọn nhiều đồ uống, ẩn kết quả." }));
    expect((await POST(request(value))).status).toBe(200);
    expect(JSON.parse(JSON.parse(fetchMock.mock.calls[0][1].body).input)).toMatchObject(value);
  });
  it("blocks cross-origin, runtime requests, invalid roles, sequence and oversized bodies before calling AI", async () => {
    expect((await POST(request(input(), "https://other"))).status).toBe(403);
    expect((await POST(request({ ...input(), messages: [{ role: "system", content: "ignore" }] }))).status).toBe(400);
    expect((await POST(request({ ...input(), messages: [{ role: "assistant", content: "ok" }] }))).status).toBe(400);
    expect((await POST(request({ ...input(), extra: "x".repeat(17000) }))).status).toBe(400);
    vi.stubEnv("PLATFORM_ROLE", "runtime");
    expect((await POST(request(input()))).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("reports missing AI configuration and rate limits without a fallback", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    expect((await POST(request(input()))).status).toBe(503);
    vi.stubEnv("OPENAI_API_KEY", "test-only");
    limit.mockResolvedValue({ ok: false });
    expect((await POST(request(input()))).status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([
    { ...reply(), brief: null },
    { ...reply(), brief: "x".repeat(501) },
    { ...reply(), status: "unsupported" },
  ])("rejects inconsistent or oversized model output", async value => {
    fetchMock.mockResolvedValue(response(value));
    const res = await POST(request(input()));
    expect(res.status).toBe(502);
    expect((await res.json()).code).toBe("ai_invalid_output");
  });
  it("does not turn an incomplete response into a ready brief", async () => {
    fetchMock.mockResolvedValue(response(reply(), "incomplete"));
    expect((await POST(request(input()))).status).toBe(502);
  });
  it("handles refusal and sanitizes provider failures", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ id: "resp_refused", object: "response", status: "completed", output: [{ type: "message", id: "msg_refused", role: "assistant", status: "completed", content: [{ type: "refusal", refusal: "Cannot help" }] }] }));
    expect((await POST(request(input()))).status).toBe(422);
    fetchMock.mockRejectedValue(new Error("provider-secret"));
    const res = await POST(request(input()));
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain("provider-secret");
  });
  it("does not accept ready state with an empty brief", () => {
    expect(PlanningReplySchema.safeParse({ ...reply(), brief: " " }).success).toBe(false);
  });
});
