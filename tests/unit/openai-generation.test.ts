import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OpenAI from "openai";
import { quizSpec } from "../support/app-spec-fixtures";
const { parse } = vi.hoisted(() => ({ parse: vi.fn() }));
vi.mock("@/lib/generation/providers/openai-client", () => ({ createOpenAIClient: () => ({ responses: { parse } }) }));
import { generateAppSpec } from "@/lib/generation/generate-app-spec";

describe("OpenAI generation boundary", () => {
  beforeEach(() => {
    vi.stubEnv("OPENAI_MODEL", "gpt-5-mini"); vi.stubEnv("OPENAI_REASONING_EFFORT", "low");
    parse.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());
  it("requests structured AppSpec with a deadline and validates the parsed result", async () => {
    parse.mockResolvedValue({ status: "completed", output: [], output_parsed: quizSpec() });
    const result = await generateAppSpec({ prompt: "Tạo quiz" });
    expect(result.spec).toEqual(quizSpec());
    expect(result.generation.provider).toBe("openai");
    const [body, options] = parse.mock.calls[0];
    expect(body).toMatchObject({ model: "gpt-5-mini", input: "Tạo quiz", store: false, text: { format: { type: "json_schema", strict: true } } });
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });
  it("rejects a request before calling OpenAI", async () => {
    await expect(generateAppSpec({ prompt: "" })).rejects.toMatchObject({ code: "invalid_request" });
    expect(parse).not.toHaveBeenCalled();
  });
  it.each([
    { status: "incomplete", output: [], output_parsed: quizSpec() },
    { status: "completed", output: [], output_parsed: null },
    { status: "completed", output: [], output_parsed: { bad: true } },
  ])("rejects incomplete or invalid output", async (response) => {
    parse.mockResolvedValue(response);
    await expect(generateAppSpec({ prompt: "quiz" })).rejects.toMatchObject({ code: "ai_invalid_output" });
  });
  it("reports refusal without falling back to mock output", async () => {
    parse.mockResolvedValue({ status: "completed", output_parsed: null, output: [{ type: "message", content: [{ type: "refusal", refusal: "no" }] }] });
    await expect(generateAppSpec({ prompt: "quiz" })).rejects.toMatchObject({ code: "ai_refused" });
  });
  it.each([new DOMException("timeout", "TimeoutError"), new OpenAI.APIConnectionTimeoutError(), new OpenAI.APIUserAbortError()])("maps timeout errors", async (error) => {
    parse.mockRejectedValue(error);
    await expect(generateAppSpec({ prompt: "quiz" })).rejects.toMatchObject({ code: "ai_timeout" });
  });
  it("omits reasoning when disabled and sanitizes unexpected provider failures", async () => {
    vi.stubEnv("OPENAI_REASONING_EFFORT", "");
    parse.mockRejectedValue(new Error("provider-secret"));
    await expect(generateAppSpec({ prompt: "quiz" })).rejects.toMatchObject({ code: "ai_unavailable", message: "ai_unavailable" });
    expect(parse.mock.calls[0][0]).not.toHaveProperty("reasoning");
  });
});
