// Defensive zod parse of the model's JSON, generated from the same brick registry as the JSON
// Schema so the two can't drift. Shape/types only; business rules are checked by AppSpecSchema.
import { z } from "zod";
import { VOCABULARY_TYPES } from "@/engine/blocks/block-vocabulary";
import { FLAT_FIELD_NAMES, MERGED_LLM_FIELDS } from "@/engine/blocks/block-llm-fields";

const flatBlockWire = z.object({
  type: z.enum(VOCABULARY_TYPES as [string, ...string[]]),
  id: z.string(),
  ...Object.fromEntries(FLAT_FIELD_NAMES.map((name) => [name, MERGED_LLM_FIELDS[name].wire])),
});

const appSpecFlatWire = z.object({
  specVersion: z.literal(1),
  locale: z.enum(["vi", "en"]),
  title: z.string(),
  description: z.string().nullable(),
  theme: z.enum(["ink", "sunset", "ocean", "forest"]),
  requireName: z.boolean(),
  layout: z.enum(["stack", "tabs"]).nullish(),
  blocks: z.array(flatBlockWire),
});

export const llmOutputWireSchema = z.object({
  outcome: z.enum(["ok", "unsupported", "refused"]),
  spec: appSpecFlatWire.nullable(),
  suggestion: z.string().nullable(),
  riskFlags: z.array(z.enum(["credential_request", "payment_request", "impersonation", "external_link", "none"])),
});

/** A flat block: `type`, `id`, plus every brick's fields (null when unused). */
export type FlatBlock = { type: string; id: string } & Record<string, unknown>;
export type FlatAppSpec = Omit<z.infer<typeof appSpecFlatWire>, "blocks"> & { blocks: FlatBlock[] };
export type LlmOutputWire = Omit<z.infer<typeof llmOutputWireSchema>, "spec"> & { spec: FlatAppSpec | null };
