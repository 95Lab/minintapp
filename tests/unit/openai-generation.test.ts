import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OpenAI from "openai";
import { quizSpec, composeSpec } from "../support/app-spec-fixtures";
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
  it("repairs unsupported output once, sharing the same deadline signal", async () => {
    const invalid = composeSpec(); const block = invalid.blocks[0]; if (block.type !== "compose") throw Error();
    block.inputs[0].multi = true;
    parse.mockResolvedValueOnce({ status: "completed", output: [], output_parsed: invalid }).mockResolvedValueOnce({ status: "completed", output: [], output_parsed: composeSpec() });
    const result = await generateAppSpec({ prompt: "Bình chọn đồ uống" });
    expect(result.generation).toMatchObject({ attempts: 2, repaired: true });
    expect(parse).toHaveBeenCalledTimes(2);
    expect(parse.mock.calls[0][1].signal).toBe(parse.mock.calls[1][1].signal);
    expect(parse.mock.calls[1][0].input).toContain("Validation feedback");
  });
  it("does not repair after the caller cancels", async () => {
    const controller = new AbortController();
    parse.mockImplementation(() => { controller.abort(); return Promise.resolve({ status: "completed", output: [], output_parsed: quizSpec() }); });
    await expect(generateAppSpec({ prompt: "quiz" }, { signal: controller.signal })).rejects.toMatchObject({ code: "ai_timeout" });
    expect(parse).toHaveBeenCalledTimes(1);
  });
  it("repairs malformed JSON once without exposing parser details", async () => {
    parse.mockRejectedValueOnce(new SyntaxError("provider raw output")).mockResolvedValueOnce({ status: "completed", output: [], output_parsed: quizSpec() });
    expect((await generateAppSpec({ prompt: "quiz" })).generation.attempts).toBe(2);
    expect(parse.mock.calls[1][0].input).not.toContain("provider raw output");
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
    expect(parse).toHaveBeenCalledTimes(1);
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
