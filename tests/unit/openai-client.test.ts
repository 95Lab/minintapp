import { afterEach, expect, it, vi } from "vitest";
import { createOpenAIClient } from "@/lib/generation/providers/openai-client";
afterEach(() => vi.unstubAllEnvs());
it("fails explicitly when no OpenAI key is configured", () => {
  vi.stubEnv("OPENAI_API_KEY", "");
  expect(createOpenAIClient).toThrow("ai_not_configured");
});
