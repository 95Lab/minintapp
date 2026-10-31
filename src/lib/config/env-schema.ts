import { z } from "zod";
const optionalText = z.string().trim().default("");
const duration = (fallback: number) => z.preprocess((value) => value === "" || value === undefined ? fallback : value, z.coerce.number().int().min(1).max(300_000));
function publicSupabaseKey(key: string) {
  if (key.startsWith("sb_publishable_")) return true;
  try { return JSON.parse(atob(key.split(".")[1].replaceAll("-", "+").replaceAll("_", "/"))).role === "anon"; } catch { return false; }
}
const httpUrl = optionalText.refine((value) => {
  if (!value) return true;
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
}, "Must be an HTTP(S) URL");
export const EnvSchema = z.object({
  PLATFORM_ROLE: z.enum(["standalone", "control", "runtime"]).default("standalone"),
  DATABASE_URL: optionalText, REDIS_URL: optionalText, WORKER_TOKEN: optionalText,
  WORKER_AGENT_URLS: optionalText, RUNTIME_IMAGE: optionalText, APPS_DOMAIN: optionalText,
  RUNTIME_APP_ID: optionalText, RUNTIME_TOKEN: optionalText, RUNTIME_SEED: optionalText,
  APP_ORIGIN: httpUrl.refine((value) => {
    if (!value) return true;
    try { return new URL(value).origin === value; } catch { return false; }
  }, "Must be a bare origin without path or trailing slash"),
  APP_STORAGE: z.enum(["memory", "supabase"]).default("memory"),
  SUPABASE_URL: httpUrl, SUPABASE_SERVICE_ROLE_KEY: optionalText,
  NEXT_PUBLIC_SUPABASE_URL: httpUrl, NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalText,
  OPENAI_API_KEY: optionalText, OPENAI_MODEL: z.preprocess((value) => value || "gpt-5-mini", z.string().trim().min(1)),
  OPENAI_REASONING_EFFORT: z.enum(["", "minimal", "low", "medium", "high"]).default("low"),
  GENERATION_DEADLINE_MS: duration(18_000),
  GENERATION_MAX_PER_HOUR: z.preprocess((v) => v === "" || v === undefined ? 30 : v, z.coerce.number().int().min(1).max(1000)),
  GENERATION_MAX_CONCURRENT: z.preprocess((v) => v === "" || v === undefined ? 2 : v, z.coerce.number().int().min(1).max(10)),
  PRESENTER_KEY: optionalText, IP_HASH_SALT: optionalText,
  ENABLE_SIMULATE: z.enum(["0", "1"]).default("0"), CSP_REPORT_ONLY: z.enum(["0", "1"]).default("0"),
  LIVE_DATA: z.enum(["off", "on", ""]).default("off"),
  // Recognize an old setting only to reject providers that are no longer supported.
  LLM_PROVIDER: z.enum(["", "openai"]).optional(),
}).superRefine((env, ctx) => {
  const required = env.PLATFORM_ROLE === "control"
    ? ["DATABASE_URL", "REDIS_URL", "WORKER_TOKEN", "WORKER_AGENT_URLS", "RUNTIME_IMAGE", "APPS_DOMAIN"] as const
    : env.PLATFORM_ROLE === "runtime" ? ["RUNTIME_APP_ID", "RUNTIME_TOKEN", "RUNTIME_SEED", "DATABASE_URL"] as const : [];
  for (const key of required) if (!env[key]) ctx.addIssue({ code: "custom", path: [key], message: "Required for selected platform role" });
  if (env.APP_STORAGE === "supabase") {
    for (const key of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const) {
      if (!env[key]) ctx.addIssue({ code: "custom", path: [key], message: "Required for Supabase storage and realtime" });
    }
    if (env.SUPABASE_URL.replace(/\/$/, "") !== env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")) ctx.addIssue({ code: "custom", path: ["NEXT_PUBLIC_SUPABASE_URL"], message: "Must refer to the same Supabase project" });
    if (env.NEXT_PUBLIC_SUPABASE_ANON_KEY && (!publicSupabaseKey(env.NEXT_PUBLIC_SUPABASE_ANON_KEY) || env.NEXT_PUBLIC_SUPABASE_ANON_KEY === env.SUPABASE_SERVICE_ROLE_KEY)) ctx.addIssue({ code: "custom", path: ["NEXT_PUBLIC_SUPABASE_ANON_KEY"], message: "Must be a public key, never the server key" });
  }

  if (env.SUPABASE_SERVICE_ROLE_KEY && !env.SUPABASE_URL) ctx.addIssue({ code: "custom", path: ["SUPABASE_URL"], message: "Supabase URL and credentials must be configured together" });
  if (env.SUPABASE_URL && !env.SUPABASE_SERVICE_ROLE_KEY && !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ctx.addIssue({ code: "custom", path: ["SUPABASE_URL"], message: "Supabase URL and credentials must be configured together" });
  if (!!env.NEXT_PUBLIC_SUPABASE_URL !== !!env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ctx.addIssue({ code: "custom", path: ["NEXT_PUBLIC_SUPABASE_URL"], message: "Public URL and public key must be configured together" });
  if (env.NEXT_PUBLIC_SUPABASE_ANON_KEY && !publicSupabaseKey(env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) ctx.addIssue({ code: "custom", path: ["NEXT_PUBLIC_SUPABASE_ANON_KEY"], message: "Must be a public key, never the server key" });
  if (env.SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_URL.replace(/\/$/, "") !== env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")) ctx.addIssue({ code: "custom", path: ["NEXT_PUBLIC_SUPABASE_URL"], message: "Must refer to the same Supabase project" });
});
export type AppEnv = z.output<typeof EnvSchema>;
