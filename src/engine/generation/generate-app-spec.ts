import type { AppSpec } from "@/engine/app-spec/app-spec-schema";
import type { LlmOutput } from "./llm-output-types";
import { runLlmGeneration } from "./llm-generation-pipeline";
import { detectLocale } from "./mock-prompt-safety-rules";
import { openAiProvider } from "./providers/openai-llm-provider";
import { buildRemixUserInput } from "./remix-user-input";
import { REMIX_INSTRUCTIONS_ADDENDUM } from "./system-prompt-vi-en";
export type { LlmOutput } from "./llm-output-types";
export { GENERATION_DEADLINE_MS } from "./generation-deadline";
function provider() { const p = (openAiProvider.isConfigured() ? openAiProvider : null); if (!p) throw new Error("ai_not_configured"); return p; }
export const generateAppSpec = (prompt: string, opts: {signal:AbortSignal}):Promise<LlmOutput> => runLlmGeneration(provider(), prompt, {...opts, locale:detectLocale(prompt),enforceLocale:true});
export const remixAppSpec = (spec:AppSpec, summary:string, instruction:string, opts:{signal:AbortSignal}):Promise<LlmOutput> => runLlmGeneration(provider(),buildRemixUserInput(spec,summary,instruction),{...opts,locale:spec.locale,instructionsAddendum:REMIX_INSTRUCTIONS_ADDENDUM});
