// OpenAI moderation fails closed on service errors.
import { openAiProvider } from "@/engine/generation/providers/openai-llm-provider";
import { logSecurityEvent } from "./log-security-event";

export async function moderatePrompt(text: string): Promise<{ ok: boolean; reason?: string }> {
  const provider = (openAiProvider.isConfigured() ? openAiProvider : null);
  if (!provider?.moderate) return { ok: true };
  try {
    return await provider.moderate(text);
  } catch {
    await logSecurityEvent("moderation_error", { detail: { provider: provider.id, message: "moderation_request_failed" } });
    return { ok: false, reason: "moderation_unavailable" };
  }
}
