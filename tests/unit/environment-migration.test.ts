import { mkdtempSync, writeFileSync, readFileSync, statSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { parseEnv } from "node:util";
import { expect, it } from "vitest";
it("renames legacy server variables in place without logging values or changing API keys", () => {
  const directory = mkdtempSync(join(tmpdir(), "minint-env-"));
  const path = join(directory, "api.env");
  const value = "fixture-not-a-real-secret";
  try {
    writeFileSync(path, ['OPENAI_API_KEY=fixture-openai', ...['POSTGRES_PASSWORD','REDIS_PASSWORD','WORKER_TOKEN','SIGNING_SECRET','S3_ACCESS_KEY_ID','S3_SECRET_ACCESS_KEY'].map(key=>`MININTAPP_${key}=${value}`)].join('\n'), {mode:0o600});
    const output = execFileSync(process.execPath, ['deploy/migrate-environment.mjs',path], {encoding:'utf8'});
    const env = parseEnv(readFileSync(path,'utf8'));
    expect(env.OPENAI_API_KEY).toBe('fixture-openai');
    expect(env.WORKER_TOKEN).toBe(value);
    expect(env.IP_HASH_SALT).toBe(value);
    expect(Object.keys(env).some(key=>key.startsWith('MININTAPP_'))).toBe(false);
    expect(env.DATABASE_URL).toContain('127.0.0.1:15432/minintapp');
    expect(statSync(path).mode & 0o777).toBe(0o600);
    expect(output).not.toContain(value);
    const original = readFileSync(path,'utf8');
    execFileSync(process.execPath,['deploy/migrate-environment.mjs',path]);
    expect(readFileSync(path,'utf8')).toBe(original);
  } finally { rmSync(directory,{recursive:true,force:true}); }
});
