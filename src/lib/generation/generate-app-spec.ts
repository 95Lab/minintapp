import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { AppSpecSchema } from "@/lib/app-spec/app-spec-schema";
import { GenerateRequestSchema } from "@/lib/api/request-schemas";
import { AppError } from "@/lib/api/app-error-codes";
import { readRuntimeConfig } from "@/lib/config/runtime-config";
import { createOpenAIClient } from "./providers/openai-client";
import { SYSTEM_PROMPT } from "./system-prompt-vi-en";
import type { GenerationResult } from "./llm-output-types";

// Generates a validated spec only. Persistence and the NDJSON route are separate layers.
export async function generateAppSpec(input: unknown): Promise<GenerationResult> {
  const request = GenerateRequestSchema.safeParse(input);
  if (!request.success) throw new AppError("invalid_request");
  const config = readRuntimeConfig();
  const client = createOpenAIClient();
  const startedAt = performance.now();
  try {
    const response = await client.responses.parse({
      model: config.OPENAI_MODEL,
      instructions: SYSTEM_PROMPT,
      input: request.data.prompt,
      store: false,
      max_output_tokens: 6000,
      ...(config.OPENAI_REASONING_EFFORT ? { reasoning: { effort: config.OPENAI_REASONING_EFFORT } } : {}),
      text: { format: zodTextFormat(AppSpecSchema, "app_spec") },
    }, { signal: AbortSignal.timeout(config.GENERATION_DEADLINE_MS) });
    if (response.output.some((item) => item.type === "message" && item.content.some((part) => part.type === "refusal"))) {
      throw new AppError("ai_refused");
    }
    if (response.status !== "completed" || !response.output_parsed) throw new AppError("ai_invalid_output");
    // Structured Outputs enforces shape; local refinements enforce cross-field business rules.
    const parsed = AppSpecSchema.safeParse(response.output_parsed);
    if (!parsed.success) throw new AppError("ai_invalid_output");
    return { spec: parsed.data, generation: { provider: "openai", model: config.OPENAI_MODEL, durationMs: Math.round(performance.now() - startedAt) } };
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof OpenAI.APIConnectionTimeoutError || error instanceof OpenAI.APIUserAbortError || (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name))) throw new AppError("ai_timeout");
    if (error instanceof OpenAI.RateLimitError) throw new AppError("rate_limited");
    if (error instanceof SyntaxError || (error instanceof Error && error.name === "ZodError")) throw new AppError("ai_invalid_output");
    throw new AppError("ai_unavailable");
  }
}
