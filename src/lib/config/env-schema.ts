import { z } from "zod";
const optionalText = z.string().trim().default("");
const duration = (fallback: number) => z.preprocess((value) => value === "" || value === undefined ? fallback : value, z.coerce.number().int().min(1).max(300_000));
const httpUrl = optionalText.refine((value) => {
  if (!value) return true;
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
}, "Must be an HTTP(S) URL");
export const EnvSchema = z.object({
  SUPABASE_URL: httpUrl, SUPABASE_SERVICE_ROLE_KEY: optionalText,
  NEXT_PUBLIC_SUPABASE_URL: httpUrl, NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalText,
  OPENAI_API_KEY: optionalText, OPENAI_MODEL: z.preprocess((value) => value || "gpt-5-mini", z.string().trim().min(1)),
  OPENAI_REASONING_EFFORT: z.enum(["", "minimal", "low", "medium", "high"]).default("low"),
  GENERATION_DEADLINE_MS: duration(18_000),
  PRESENTER_KEY: optionalText, IP_HASH_SALT: optionalText,
  ENABLE_SIMULATE: z.enum(["0", "1"]).default("0"), CSP_REPORT_ONLY: z.enum(["0", "1"]).default("0"),
  LIVE_DATA: z.enum(["off", "on", ""]).default("off"),
  // Recognize an old setting only to reject providers that are no longer supported.
  LLM_PROVIDER: z.enum(["", "openai"]).optional(),
}).superRefine((env, ctx) => {
  for (const [url, key] of [["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"], ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]] as const) {
    if (!!env[url] !== !!env[key]) ctx.addIssue({ code: "custom", path: [url], message: `${url} and ${key} must be configured together` });
  }
});
export type AppEnv = z.output<typeof EnvSchema>;
