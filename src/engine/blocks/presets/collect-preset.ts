// Preset: collect — form / group order ("trà sữa 35k, trà đào 40k…"). Expands to compose: select
// fields become priced choice inputs, the first number field is the quantity, and an `orders` view
// totals the money on the server (participants see count + total, the host sees every order).
import { z } from "zod";
import { Id, jsonNullableEnum, jsonNullableString, Text } from "../block-schema-primitives";
import type { ComposeInput } from "../compose/compose-atoms-schema";
import { optionIdsFromLabels, type PresetDefinition } from "./preset-definition-types";

export const CollectFieldSchema = z.object({
  id: Id,
  label: Text,
  kind: z.enum(["short_text", "number", "select"]),
  // select options; unitPrice (VND) makes the option count toward sum_price
  options: z.array(z.object({ label: Text, unitPrice: z.number().nonnegative().nullable() })).max(20).nullable(),
}).refine((f) => f.kind !== "select" || (f.options?.length ?? 0) >= 2, { message: "a select field needs at least 2 options", path: ["options"] });
export type CollectField = z.infer<typeof CollectFieldSchema>;

export const CollectBlockSchema = z.object({
  type: z.literal("collect"),
  id: Id,
  title: Text,
  fields: z.array(CollectFieldSchema).min(1).max(8),
  aggregate: z.enum(["count", "sum_price", "none"]),
});
export type CollectBlock = z.infer<typeof CollectBlockSchema>;

const jsonField = {
  type: "object",
  properties: {
    id: { type: "string" },
    label: { type: "string" },
    kind: { enum: ["short_text", "number", "select"] },
    options: {
      anyOf: [
        {
          type: "array",
          items: { type: "object", properties: { label: { type: "string" }, unitPrice: { type: ["number", "null"] } }, required: ["label", "unitPrice"], additionalProperties: false },
        },
        { type: "null" },
      ],
    },
  },
  required: ["id", "label", "kind", "options"],
  additionalProperties: false,
};
const wireField = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum(["short_text", "number", "select"]),
  options: z.array(z.object({ label: z.string(), unitPrice: z.number().nullable() })).nullable(),
});

function fieldToInput(f: CollectField, priced: boolean): ComposeInput {
  const base = { id: f.id, label: f.label, options: null, multi: null, capacity: null, min: null, max: null, unit: null, showIf: null, timeLimitSec: null };
  if (f.kind === "number") return { ...base, kind: "number", required: false, min: 1, max: 99 };
  if (f.kind === "short_text") return { ...base, kind: "text", required: false };
  const options = f.options ?? [];
  const ids = optionIdsFromLabels(options.map((o) => o.label));
  return { ...base, kind: "choice", required: true, multi: false, options: options.map((o, i) => ({ id: ids[i], label: o.label, price: priced ? o.unitPrice : null })) };
}

export const collectPreset: PresetDefinition<CollectBlock> = {
  type: "collect",
  label: { vi: "Form / gom đơn", en: "Form / group order" },
  promptDoc: `collect — thu thập/gom đơn: title, fields (1–8, mỗi field {id,label,kind:"short_text"|"number"|
   "select", options}), aggregate ("count" | "sum_price" | "none").`,
  promptRules: `- "gom đơn" / "đặt món" / "group order" → collect, aggregate: "sum_price", mỗi món là một option trong
  field kind:"select" với unitPrice VND ("35k" → 35000). Field không có giá → unitPrice: null, hoặc kind "number"/"short_text".`,
  specSchema: CollectBlockSchema,
  llmFields: {
    title: { json: jsonNullableString, wire: z.string().nullable() },
    fields: { json: { anyOf: [{ type: "array", items: jsonField }, { type: "null" }] }, wire: z.array(wireField).nullable() },
    aggregate: { json: jsonNullableEnum(["count", "sum_price", "none"]), wire: z.enum(["count", "sum_price", "none"]).nullable() },
  },
  fromFlat: (f) => ({
    type: "collect",
    id: f.id,
    title: (f.title as string) ?? "",
    fields: (f.fields as CollectField[]) ?? [],
    aggregate: (f.aggregate as CollectBlock["aggregate"]) ?? "none",
  }),
  toFlat: (b) => ({ title: b.title, fields: b.fields, aggregate: b.aggregate }),

  expand(b) {
    const priced = b.aggregate === "sum_price";
    return {
      type: "compose",
      id: b.id,
      title: b.title,
      note: null,
      entries: "one",
      flow: "open",
      inputs: b.fields.map((f) => fieldToInput(f, priced)),
      views: [{ id: "orders", kind: "orders", title: null, source: b.fields.find((f) => f.kind === "number")?.id ?? null, op: null, topN: null, teams: null, query: null, visibleTo: "everyone" }],
    };
  },
};
