import { generateAppSpec } from "../src/lib/generation/generate-app-spec";
import { generateAppSpec as generateEngineSpec, remixAppSpec } from "../src/engine/generation/generate-app-spec";
import { AppSpecSchema as EngineSpecSchema } from "../src/engine/app-spec/app-spec-schema";
import { activeLlmProvider } from "../src/engine/generation/providers/provider-registry";
import { looksLikePhishing } from "../src/engine/generation/mock-prompt-safety-rules";
import { scanAppSpecPhishing } from "../src/engine/security/scan-app-spec-phishing";
import { AppError } from "../src/lib/api/app-error-codes";
import type { Deployment } from "./contracts";
export async function buildSpec(input: Deployment["input"]) {
  if (input.spec) return { spec: input.spec, generation: null };
  if (!input.engine) return generateAppSpec(input);
  if (looksLikePhishing(input.prompt)) throw new AppError("ai_refused");
  const provider = activeLlmProvider(); if (!provider) throw new AppError("ai_not_configured");
  const signal = AbortSignal.timeout(Number(process.env.GENERATION_DEADLINE_MS || 60000));
  const text = input.remix?.instruction || input.prompt;
  const [result, moderation] = await Promise.all([input.remix ? remixAppSpec(EngineSpecSchema.parse(input.remix.spec), input.remix.summary, input.remix.instruction, { signal }) : generateEngineSpec(input.prompt, { signal }), provider.moderate ? provider.moderate(text) : Promise.resolve({ ok: true })]);
  if (!moderation.ok || result.outcome === "refused") throw new AppError("ai_refused");
  if (!result.spec || result.outcome !== "ok") throw new AppError("ai_invalid_output");
  if (!scanAppSpecPhishing(result.spec, result.riskFlags).ok) throw new AppError("ai_refused");
  return { spec: result.spec, generation: result.generation || null };
}
