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
