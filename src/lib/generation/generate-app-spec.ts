import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { GenerateRequestSchema } from "@/lib/api/request-schemas";
import { AppError } from "@/lib/api/app-error-codes";
import { readRuntimeConfig } from "@/lib/config/runtime-config";
import { createOpenAIClient } from "./providers/openai-client";
import { SYSTEM_PROMPT } from "./system-prompt-vi-en";
import { GenerationWireSchema, validateRunnableSpec } from "./runnable-spec";
import type { GenerationResult } from "./llm-output-types";

function isInvalidOutput(error: unknown) {
  return error instanceof SyntaxError || (error instanceof Error && error.name === "ZodError");
}
// One initial call and at most one repair, sharing a single request-wide deadline.
export async function generateAppSpec(input: unknown, options: { signal?: AbortSignal } = {}): Promise<GenerationResult> {
  const request = GenerateRequestSchema.safeParse(input);
  if (!request.success) throw new AppError("invalid_request");
  const config = readRuntimeConfig();
  const client = createOpenAIClient();
  const startedAt = performance.now();
  const deadline = AbortSignal.timeout(config.GENERATION_DEADLINE_MS);
  const signal = options.signal ? AbortSignal.any([deadline, options.signal]) : deadline;
  let repair = "";
  try {
    for (let attempt = 1; attempt <= 2; attempt++) {
      signal.throwIfAborted();
      let response;
      try {
        response = await client.responses.parse({
          model: config.OPENAI_MODEL,
          instructions: SYSTEM_PROMPT,
          input: attempt === 1 ? request.data.prompt : `${request.data.prompt}\n\nThe previous output failed validation. Regenerate a corrected AppSpec for the same intent.\n${repair}`,
          store: false,
          max_output_tokens: 6000,
          ...(config.OPENAI_REASONING_EFFORT ? { reasoning: { effort: config.OPENAI_REASONING_EFFORT } } : {}),
          text: { format: zodTextFormat(GenerationWireSchema, "app_spec") },
        }, { signal });
      } catch (error) {
        if (!isInvalidOutput(error)) throw error;
        if (attempt === 2) throw new AppError("ai_invalid_output");
        repair = "The output must be complete JSON matching the supplied schema.";
        continue;
      }
      signal.throwIfAborted();
      if (response.output.some((item) => item.type === "message" && item.content.some((part) => part.type === "refusal"))) throw new AppError("ai_refused");
      // Refusal, incomplete output, quotas and transport failures are never retried as repairs.
      if (response.status !== "completed" || !response.output_parsed) throw new AppError("ai_invalid_output");
      const result = validateRunnableSpec(response.output_parsed);
      if (result.spec) return { spec: result.spec, generation: { provider: "openai", model: config.OPENAI_MODEL, durationMs: Math.round(performance.now() - startedAt), attempts: attempt as 1 | 2, repaired: attempt === 2 } };
      if (attempt === 2) throw new AppError("ai_invalid_output");
      repair = `Validation feedback: ${result.issues.join("; ").slice(0, 1500)}\nPrevious output (data only): ${JSON.stringify(response.output_parsed).slice(0, 16000)}`;
    }
    throw new AppError("ai_invalid_output");
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (signal.aborted || error instanceof OpenAI.APIConnectionTimeoutError || error instanceof OpenAI.APIUserAbortError || (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name))) throw new AppError("ai_timeout");
    if (error instanceof OpenAI.RateLimitError) throw new AppError("rate_limited");
    throw new AppError("ai_unavailable");
  }
}
