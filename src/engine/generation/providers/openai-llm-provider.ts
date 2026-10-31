// OpenAI adapter ("Codex"): Responses API with a strict JSON-schema text format, plus the
// omni-moderation endpoint for input moderation. Maps every SDK failure onto LlmCallError.
import OpenAI from "openai";
import { runtimeConfig } from "@/engine/config/runtime-config";
import { getOpenAiClient } from "./openai-client";
import { LlmCallError, type LlmProvider, type ModerationResult, type StructuredCallRequest } from "./llm-provider-types";

/** Includes reasoning tokens on reasoning models: a 20-question quiz + reasoning needs headroom. */
const MAX_OUTPUT_TOKENS = 10_000;
const MODERATION_MODEL = "omni-moderation-latest";
const MODERATION_TIMEOUT_MS = 4000;
const VALID_REASONING_EFFORTS: ReadonlySet<string> = new Set(["none", "minimal", "low", "medium", "high", "xhigh", "max"]);

function reasoningParam(): { reasoning: { effort: OpenAI.ReasoningEffort } } | Record<string, never> {
  const effort = runtimeConfig.openaiReasoningEffort;
  return effort && VALID_REASONING_EFFORTS.has(effort) ? { reasoning: { effort: effort as OpenAI.ReasoningEffort } } : {};
}

async function callStructured({ instructions, input, jsonSchema, schemaName, signal }: StructuredCallRequest): Promise<unknown> {
  if (signal.aborted) throw new LlmCallError("aborted", signal.reason);

  let text: string;
  try {
    const response = await getOpenAiClient().responses.create(
      {
        model: runtimeConfig.openaiModel,
        store: false,
        instructions,
        input,
        max_output_tokens: MAX_OUTPUT_TOKENS,
        text: { format: { type: "json_schema", name: schemaName, strict: true, schema: jsonSchema } },
        ...reasoningParam(),
      },
      { signal },
    );
    // Truncated output (token cap) would otherwise surface as invalid JSON with no clue why.
    if (response.status === "incomplete") {
      console.error(`[openai] incomplete response: ${response.incomplete_details?.reason ?? "unknown"} (model ${runtimeConfig.openaiModel})`);
      throw new LlmCallError("incomplete");
    }
    text = response.output_text;
  } catch (err) {
    if (err instanceof LlmCallError) throw err;
    if (signal.aborted) throw new LlmCallError("aborted", err);
    // Surface schema rejections / auth / quota errors in server logs (never the key itself).
    const status = err instanceof OpenAI.APIError ? err.status : undefined;
    console.error("[openai] request failed", {status});
    throw new LlmCallError("network", err);
  }

  if (!text) throw new LlmCallError("empty_output");
  try {
    return JSON.parse(text) as unknown;
  } catch (err) {
    throw new LlmCallError("invalid_json", err);
  }
}

async function moderate(text: string): Promise<ModerationResult> {
  const result = await getOpenAiClient().moderations.create({ model: MODERATION_MODEL, input: text }, { timeout: MODERATION_TIMEOUT_MS });
  const first = result.results[0];
  if (!first?.flagged) return { ok: true };
  const categories = Object.entries(first.categories)
    .filter(([, flagged]) => flagged === true)
    .map(([category]) => category);
  return { ok: false, reason: categories.join(",") || "flagged" };
}

export const openAiProvider: LlmProvider = {
  id: "openai",
  label: "Codex (OpenAI)",
  isConfigured: () => !!runtimeConfig.openaiApiKey,
  model: () => runtimeConfig.openaiModel,
  callStructured,
  moderate,
};
