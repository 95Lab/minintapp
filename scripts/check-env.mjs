import { EnvSchema } from "../src/lib/config/env-schema.ts";
const result = EnvSchema.safeParse(process.env);
if (!result.success) {
  for (const issue of result.error.issues) console.error(`${issue.path.join(".")}: ${issue.message}`);
  process.exitCode = 1;
} else console.log("Environment configuration valid (OpenAI only). Integration connectivity was not checked.");
