import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
const run = (env: Record<string, string | undefined>) => spawnSync(process.execPath, ["scripts/check-env.mjs"], { env: { ...env, NODE_ENV: "test" }, encoding: "utf8" });
describe("environment validation", () => {
  it("allows a clean offline setup", () => { expect(run({}).status).toBe(0); });
  it("rejects partial Supabase credentials without logging secrets", () => {
    const result = run({ SUPABASE_SERVICE_ROLE_KEY: "secret-value" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("configured together");
    expect(result.stderr).not.toContain("secret-value");
  });
  it.each([{ SUPABASE_URL: "file:///tmp/db", SUPABASE_SERVICE_ROLE_KEY: "key" },
    { GENERATION_DEADLINE_MS: "NaN" }, { APP_ORIGIN: "https://app.example.com/path" }, { APP_ORIGIN: "bad-url" }, { OPENAI_REASONING_EFFORT: "invalid" },
    { LLM_PROVIDER: "gemini" }, { ENABLE_SIMULATE: "true" }])("rejects invalid config %j", (env) => {
    expect(run(env).status).toBe(1);
  });
});
it("requires complete Supabase configuration and rejects a secret in the public key", () => {
  expect(run({ APP_STORAGE: "supabase" }).status).toBe(1);
  const base = { APP_STORAGE: "supabase", SUPABASE_URL: "https://test.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "sb_secret_private", NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_test" };
  expect(run(base).status).toBe(0);
  expect(run({ ...base, NEXT_PUBLIC_SUPABASE_URL: "https://other.supabase.co" }).status).toBe(1);
  const bad = run({ ...base, NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_secret_private" });
  expect(bad.status).toBe(1); expect(bad.stderr).not.toContain("sb_secret_private");
});
it("allows auth-only Supabase configuration while application data uses PostgreSQL", () => {
 const auth={SUPABASE_URL:"https://test.supabase.co",NEXT_PUBLIC_SUPABASE_URL:"https://test.supabase.co",NEXT_PUBLIC_SUPABASE_ANON_KEY:"sb_publishable_test",IP_HASH_SALT:"fixture-signing-secret",APP_STORAGE:"memory"};
 expect(run(auth).status).toBe(0);
 expect(run({...auth,NEXT_PUBLIC_SUPABASE_ANON_KEY:"sb_secret_private"}).status).toBe(1);
});
