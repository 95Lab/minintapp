import "server-only";
import OpenAI from "openai";
import { readRuntimeConfig } from "@/lib/config/runtime-config";
import { AppError } from "@/lib/api/app-error-codes";
// Lazy initialization: a clean checkout can build without secrets.
export function createOpenAIClient(): OpenAI {
  const config = readRuntimeConfig();
  if (!config.OPENAI_API_KEY) throw new AppError("ai_not_configured");
  return new OpenAI({ apiKey: config.OPENAI_API_KEY, maxRetries: 0, timeout: config.GENERATION_DEADLINE_MS });
}
