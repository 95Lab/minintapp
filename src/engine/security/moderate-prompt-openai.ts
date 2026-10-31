// Moderates the raw prompt before generation using the ACTIVE provider's moderation, if it has
// one (OpenAI: omni-moderation; Gemini: none — its safety filters act during generation instead).
// No provider (mock mode) → allow. Fails OPEN (allow + log) on any error: a moderation outage
// should never be the reason a demo is stuck refusing every prompt; the phishing scan and model
// riskFlags still run after generation.
import { activeLlmProvider } from "@/engine/generation/providers/provider-registry";
import { logSecurityEvent } from "./log-security-event";

export async function moderatePrompt(text: string): Promise<{ ok: boolean; reason?: string }> {
  const provider = activeLlmProvider();
  if (!provider?.moderate) return { ok: true };
  try {
    return await provider.moderate(text);
  } catch (err) {
    await logSecurityEvent("moderation_error", { detail: { provider: provider.id, message: "Moderation provider request failed" } });
    return { ok: true }; // fail-open
  }
}
