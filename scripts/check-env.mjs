// Do not log values: environment may contain privileged credentials.
const errors = [];
for (const [urlKey, keyKey] of [
  ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
  ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
]) {
  const url = process.env[urlKey]?.trim();
  const key = process.env[keyKey]?.trim();
  if (!!url !== !!key) errors.push(`${urlKey} and ${keyKey} must be configured together`);
  if (url) {
    try { if (!["http:", "https:"].includes(new URL(url).protocol)) throw Error(); }
    catch { errors.push(`${urlKey} must be an HTTP(S) URL`); }
  }
}
for (const name of ["GENERATION_DEADLINE_MS", "GEMINI_MODEL_TIMEOUT_MS"]) {
  const value = process.env[name];
  if (value && (!Number.isSafeInteger(Number(value)) || Number(value) <= 0)) errors.push(`${name} must be a positive integer`);
}
const provider = process.env.LLM_PROVIDER?.trim();
if (provider && !["openai", "gemini", "groq", "lmstudio"].includes(provider)) errors.push("Unsupported LLM_PROVIDER");
for (const name of ["ENABLE_SIMULATE", "CSP_REPORT_ONLY"]) {
  if (process.env[name] && !["0", "1"].includes(process.env[name])) errors.push(`${name} must be 0 or 1`);
}
if (errors.length) { console.error(errors.join("\n")); process.exitCode = 1; }
else console.log("Environment configuration valid. Integration connectivity was not checked.");
