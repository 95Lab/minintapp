import { z } from "zod";
import { HostnameSchema } from "../deployments/deployment-schema.js";
const Text = z.string().trim().min(1).max(500);
export const PollRuntimeManifestSchema = z.strictObject({
  templateVersion: z.literal("poll-v1"),
  appId: z.string().regex(/^[a-f0-9]{24}$/),
  deploymentId: z.string().regex(/^[a-f0-9]{24}$/),
  specHash: z.string().regex(/^[a-f0-9]{64}$/),
  hostname: HostnameSchema,
  expiresAt: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  locale: z.enum(["vi", "en"]),
  theme: z.enum(["ink", "sunset", "ocean", "forest"]),
  title: Text,
  description: Text.nullable(),
  blockTitle: Text,
  note: Text.nullable(),
  question: Text,
  resultsTitle: Text,
  requireName: z.boolean(),
  options: z.array(z.strictObject({ id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/), label: Text })).min(2).max(10)
    .refine(options => new Set(options.map(o => o.id)).size === options.length, "Duplicate option ids"),
  resultsVisibility: z.enum(["everyone", "after_submit", "after_close", "host"]),
});
export type PollRuntimeManifest = z.infer<typeof PollRuntimeManifestSchema>;
