import "server-only";
import { readRuntimeConfig } from "@/lib/config/runtime-config";
const env = readRuntimeConfig();
export const runtimeConfig = {
  supabaseUrl: env.SUPABASE_URL, supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  supabaseAnonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, openaiApiKey: env.OPENAI_API_KEY,
  openaiModel: env.OPENAI_MODEL, openaiReasoningEffort: env.OPENAI_REASONING_EFFORT,
  presenterKey: env.PRESENTER_KEY, ipHashSalt: env.IP_HASH_SALT || "minint-dev-salt",
  simulateEnabled: env.ENABLE_SIMULATE === "1",
};
export const storageMode = () => env.APP_STORAGE;
export const accountsEnabled = () => env.APP_STORAGE === "supabase" && !!env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
