// Shared zod building blocks for every brick's spec schema. Every Text is rendered escaped and may
// never carry URLs/HTML/JS (the phishing scan also rejects URL-like text).
import { z } from "zod";

export const Text = z.string().min(1).max(200);
export const Id = z.string().min(1).max(40).regex(/^[a-z0-9_-]+$/i).refine(id=>!["__proto__","constructor","prototype"].includes(id.toLowerCase()),"Reserved identifier");
export const OptionSchema = z.object({ id: Id, label: Text });
export type Option = z.infer<typeof OptionSchema>;

/** JSON Schema fragments for the AI-facing flat block (strict mode: every key present, nullable). */
export type JsonSchema = Record<string, unknown>;
export const jsonNullableString: JsonSchema = { type: ["string", "null"] };
export const jsonNullableBoolean: JsonSchema = { type: ["boolean", "null"] };
export const jsonNullableInteger: JsonSchema = { type: ["integer", "null"] };
export const jsonOption: JsonSchema = {
  type: "object",
  properties: { id: { type: "string" }, label: { type: "string" } },
  required: ["id", "label"],
  additionalProperties: false,
};
export const jsonNullableOptions: JsonSchema = { anyOf: [{ type: "array", items: jsonOption }, { type: "null" }] };
export const jsonNullableEnum = (values: string[]): JsonSchema => ({ enum: [...values, null] });

/** Matching loose zod for parsing the model's flat output (shape only; business rules come later). */
export const wireOption = z.object({ id: z.string(), label: z.string() });
