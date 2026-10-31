// Builds the AI-facing "flat block" from every brick's llmFields: ONE object type carrying every
// field of every brick (unused ones null), because strict structured output handles discriminated
// unions poorly. Bricks may share a field name only if they declare the identical JSON schema.
import { VOCABULARY_TYPES, vocabularyEntry } from "./block-vocabulary";
import type { LlmField } from "./block-definition-types";

function buildMergedFields(): Record<string, LlmField> {
  const merged: Record<string, LlmField> = {};
  for (const type of VOCABULARY_TYPES) {
    for (const [name, field] of Object.entries(vocabularyEntry(type).llmFields)) {
      if (name === "type" || name === "id") throw new Error(`brick "${type}": llmField "${name}" is reserved`);
      const existing = merged[name];
      if (existing && JSON.stringify(existing.json) !== JSON.stringify(field.json)) {
        throw new Error(`brick "${type}": llmField "${name}" conflicts with another brick's definition — rename it or use the same schema`);
      }
      merged[name] = existing ?? field;
    }
  }
  return merged;
}

/** Every flat field name → its JSON schema + loose wire zod. Computed once at module load. */
export const MERGED_LLM_FIELDS: Readonly<Record<string, LlmField>> = buildMergedFields();
export const FLAT_FIELD_NAMES = Object.keys(MERGED_LLM_FIELDS);
