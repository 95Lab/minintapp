// Strict JSON Schema for LLM structured output, generated from the brick registry. Structural
// keywords only (type/properties/required/additionalProperties/enum/items/anyOf); length limits,
// id patterns and array bounds are enforced afterwards by AppSpecSchema (zod), whose failure
// triggers one repair call. Every property is required; optional ones are nullable.
import { VOCABULARY_TYPES } from "@/engine/blocks/block-vocabulary";
import { FLAT_FIELD_NAMES, MERGED_LLM_FIELDS } from "@/engine/blocks/block-llm-fields";

import { COMPOSE_EXPR_DEFINITIONS } from "@/engine/blocks/compose/compose-llm-query-wire";

type JsonSchema = Record<string, unknown>;

/** One object type covering every brick's fields; unused fields are null. */
const FLAT_BLOCK_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    type: { enum: VOCABULARY_TYPES },
    id: { type: "string" },
    ...Object.fromEntries(FLAT_FIELD_NAMES.map((name) => [name, MERGED_LLM_FIELDS[name].json])),
  },
  required: ["type", "id", ...FLAT_FIELD_NAMES],
  additionalProperties: false,
};

const APP_SPEC_FLAT_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    specVersion: { enum: [1] },
    locale: { enum: ["vi", "en"] },
    title: { type: "string" },
    description: { type: ["string", "null"] },
    theme: { enum: ["ink", "sunset", "ocean", "forest"] },
    requireName: { type: "boolean" },
    layout: { anyOf: [{ enum: ["stack", "tabs"] }, { type: "null" }] },
    blocks: { type: "array", items: FLAT_BLOCK_SCHEMA },
  },
  required: ["specVersion", "locale", "title", "description", "theme", "requireName", "layout", "blocks"],
  additionalProperties: false,
};

/** Top-level shape the model must return: `LlmOutput` with `spec` in the flat wire format. */
export const LLM_OUTPUT_JSON_SCHEMA: JsonSchema = {
  $defs: COMPOSE_EXPR_DEFINITIONS,
  type: "object",
  properties: {
    outcome: { enum: ["ok", "unsupported", "refused"] },
    spec: { anyOf: [APP_SPEC_FLAT_SCHEMA, { type: "null" }] },
    suggestion: { type: ["string", "null"] },
    riskFlags: { type: "array", items: { enum: ["credential_request", "payment_request", "impersonation", "external_link", "none"] } },
  },
  required: ["outcome", "spec", "suggestion", "riskFlags"],
  additionalProperties: false,
};
