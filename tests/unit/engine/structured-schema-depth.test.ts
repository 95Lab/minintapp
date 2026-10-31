import { expect, it } from "vitest";
import { LLM_OUTPUT_JSON_SCHEMA } from "@/engine/generation/llm-output-json-schema";

type Schema = { type?: string | string[]; properties?: Record<string, Schema>; items?: Schema; anyOf?: Schema[] };
function depth(schema: Schema): number {
  const children = [...Object.values(schema.properties || {}), ...(schema.items ? [schema.items] : []), ...(schema.anyOf || [])];
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  const level = types.includes("object") ? 1 : 0;
  return level + Math.max(0, ...children.map(depth));
}
it("keeps the complete brick schema within the OpenAI nesting limit", () => {
  expect(depth(LLM_OUTPUT_JSON_SCHEMA)).toBeLessThanOrEqual(10);
  for (const definition of Object.values(LLM_OUTPUT_JSON_SCHEMA.$defs as Record<string, Schema>)) expect(depth(definition)).toBeLessThanOrEqual(10);
});
