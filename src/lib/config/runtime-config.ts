import "server-only";
import { EnvSchema } from "./env-schema";
export function readRuntimeConfig() {
  const parsed = EnvSchema.safeParse(process.env);
  // Zod's full error may include configuration details; expose field names only.
  if (!parsed.success) throw new Error(`Invalid environment fields: ${[...new Set(parsed.error.issues.map((i) => i.path.join(".")))].join(", ")}`);
  return parsed.data;
}
