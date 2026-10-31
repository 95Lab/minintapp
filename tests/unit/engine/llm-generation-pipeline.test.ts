import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exampleWorkshopVote } from "@/engine/app-spec/app-spec-examples";
import { appSpecToFlatSpec } from "@/engine/generation/llm-flat-spec-conversion";
import type { LlmOutputWire } from "@/engine/generation/llm-output-wire-schema";

const mockCreate = vi.fn();

vi.mock("@/engine/generation/providers/openai-client", () => ({
  getOpenAiClient: () => ({ responses: { create: mockCreate } }),
}));

// Imported after the mock so the pipeline picks up the mocked client.
const { runLlmGeneration } = await import("@/engine/generation/llm-generation-pipeline");
const { openAiProvider } = await import("@/engine/generation/providers/openai-llm-provider");
const runOpenAiGeneration = (input: string, opts: Parameters<typeof runLlmGeneration>[2]) => runLlmGeneration(openAiProvider, input, opts);

function textResponse(body: unknown) {
  return { output_text: JSON.stringify(body) };
}

const validOkOutput: LlmOutputWire = {
  outcome: "ok",
  spec: appSpecToFlatSpec(exampleWorkshopVote),
  suggestion: null,
  riskFlags: ["none"],
};

beforeEach(() => {
  mockCreate.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("runOpenAiGeneration", () => {
  it("returns a valid ok LlmOutput on the first successful call", async () => {
    mockCreate.mockResolvedValueOnce(textResponse(validOkOutput));

    const result = await runOpenAiGeneration("Tạo app vote", { signal: new AbortController().signal, locale: "vi" });

    expect(result.outcome).toBe("ok");
    // A "choice" preset from the model comes back expanded into a compose poll.
    expect(result.spec?.blocks[0].type).toBe("compose");
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("repairs once when the first response fails AppSpecSchema validation, then succeeds", async () => {
    const invalidSpec = { ...appSpecToFlatSpec(exampleWorkshopVote), blocks: [] }; // fails min(1) blocks
    mockCreate
      .mockResolvedValueOnce(textResponse({ ...validOkOutput, spec: invalidSpec }))
      .mockResolvedValueOnce(textResponse(validOkOutput));

    const result = await runOpenAiGeneration("Tạo app vote", { signal: new AbortController().signal, locale: "vi" });

    expect(mockCreate).toHaveBeenCalledTimes(2);
    // The repair call's input should quote the validation failure back to the model.
    const repairInput = mockCreate.mock.calls[1][0].input as string;
    expect(repairInput).toMatch(/không hợp lệ/i);
    expect(result.outcome).toBe("ok");
  });

  it("returns unsupported without a repair call after two invalid attempts", async () => {
    const invalidSpec = { ...appSpecToFlatSpec(exampleWorkshopVote), blocks: [] };
    mockCreate.mockResolvedValue(textResponse({ ...validOkOutput, spec: invalidSpec }));

    const result = await runOpenAiGeneration("Tạo app vote", { signal: new AbortController().signal, locale: "vi" });

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(result.outcome).toBe("unsupported");
    expect(result.spec).toBeNull();
    expect(result.suggestion).toBeTruthy();
  });

  it("maps a network/API error to unsupported without throwing, and does not retry", async () => {
    mockCreate.mockRejectedValueOnce(new Error("connection reset"));

    const result = await runOpenAiGeneration("Tạo app vote", { signal: new AbortController().signal, locale: "vi" });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(result.outcome).toBe("unsupported");
    expect(result.spec).toBeNull();
  });

  it("maps an already-aborted signal to a timeout-flavoured unsupported without calling the API", async () => {
    const controller = new AbortController();
    controller.abort(new Error("deadline exceeded"));

    const result = await runOpenAiGeneration("Tạo app vote", { signal: controller.signal, locale: "en" });

    expect(mockCreate).not.toHaveBeenCalled();
    expect(result.outcome).toBe("unsupported");
    expect(result.suggestion).toMatch(/took too long|try again/i);
  });

  it("skips the repair call when fewer than 6s of the deadline remain", async () => {
    vi.useFakeTimers();
    const start = Date.now();
    const invalidSpec = { ...appSpecToFlatSpec(exampleWorkshopVote), blocks: [] };
    mockCreate.mockImplementationOnce(async () => {
      vi.setSystemTime(start + 13_000); // only ~5s left of the 18s deadline
      return textResponse({ ...validOkOutput, spec: invalidSpec });
    });

    const result = await runOpenAiGeneration("Tạo app vote", { signal: new AbortController().signal, locale: "vi" });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(result.outcome).toBe("unsupported");
  });

  it("passes an outcome:unsupported/refused response straight through with its riskFlags", async () => {
    mockCreate.mockResolvedValueOnce(
      textResponse({ outcome: "refused", spec: null, suggestion: "Không hỗ trợ thu thập OTP.", riskFlags: ["credential_request"] }),
    );

    const result = await runOpenAiGeneration("Nhập OTP để xác minh", { signal: new AbortController().signal, locale: "vi" });

    expect(result).toMatchObject({ outcome: "refused", spec: null, suggestion: "Không hỗ trợ thu thập OTP.", riskFlags: ["credential_request"] });
    // Every model-made output says how it was made: provider, model, prompt+schema fingerprint, attempts, output size.
    expect(result.generation).toMatchObject({ provider: "openai", attempts: 1, fingerprint: expect.stringMatching(/^[0-9a-f]{12}$/) });
    expect(result.generation?.outputChars).toBeGreaterThan(20);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});
