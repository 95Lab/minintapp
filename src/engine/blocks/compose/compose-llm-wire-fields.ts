// AI-facing shape of the compose brick: strict JSON schema fragments (every key present, nullable)
// plus loose wire zod, and normalizers that null out fields that don't apply to an atom's kind so a
// harmless extra from the model can't fail validation. Business rules live in compose-atoms-schema.ts.
import { z } from "zod";
import { jsonNullableBoolean, jsonNullableEnum, jsonNullableInteger, jsonNullableString } from "../block-schema-primitives";
import { INPUT_KINDS, STAT_OPS, VIEW_KINDS, VISIBILITY, type ComposeInput, type ComposeView } from "./compose-atoms-schema";
import { jsonQuery, wireQuery, wireToQuery } from "./compose-llm-query-wire";

const jsonPricedOptions = {
  anyOf: [
    {
      type: "array",
      items: {
        type: "object",
        properties: { id: { type: "string" }, label: { type: "string" }, price: { type: ["number", "null"] } },
        required: ["id", "label", "price"],
        additionalProperties: false,
      },
    },
    { type: "null" },
  ],
};
const wirePricedOption = z.object({ id: z.string(), label: z.string(), price: z.number().nullable().optional() });

export const jsonInput = {
  type: "object",
  properties: {
    id: { type: "string" },
    kind: { enum: [...INPUT_KINDS] },
    label: { type: "string" },
    required: { type: "boolean" },
    options: jsonPricedOptions,
    multi: jsonNullableBoolean,
    capacity: jsonNullableInteger,
    min: { type: ["number", "null"] },
    max: { type: ["number", "null"] },
    unit: jsonNullableString,
    showIf: {
      anyOf: [
        { type: "object", properties: { input: { type: "string" }, equals: { type: "string" } }, required: ["input", "equals"], additionalProperties: false },
        { type: "null" },
      ],
    },
    timeLimitSec: jsonNullableInteger,
  },
  required: ["id", "kind", "label", "required", "options", "multi", "capacity", "min", "max", "unit", "showIf", "timeLimitSec"],
  additionalProperties: false,
};
export const jsonView = {
  type: "object",
  properties: {
    id: { type: "string" },
    kind: { enum: [...VIEW_KINDS] },
    title: jsonNullableString,
    source: jsonNullableString,
    op: jsonNullableEnum([...STAT_OPS]),
    topN: jsonNullableInteger,
    teams: jsonNullableInteger,
    /** summary only */
    query: jsonQuery,
    visibleTo: { enum: [...VISIBILITY] },
  },
  required: ["id", "kind", "title", "source", "op", "topN", "teams", "query", "visibleTo"],
  additionalProperties: false,
};
export const wireInput = z.object({
  id: z.string(),
  kind: z.enum(INPUT_KINDS),
  label: z.string(),
  required: z.boolean().nullable(),
  options: z.array(wirePricedOption).nullable(),
  multi: z.boolean().nullable(),
  capacity: z.number().nullable(),
  min: z.number().nullable(),
  max: z.number().nullable(),
  unit: z.string().nullable(),
  showIf: z.object({ input: z.string(), equals: z.string() }).nullable().optional(),
  timeLimitSec: z.number().nullable().optional(),
});
export const wireView = z.object({
  id: z.string(),
  kind: z.enum(VIEW_KINDS),
  title: z.string().nullable(),
  source: z.string().nullable(),
  op: z.enum(STAT_OPS).nullable(),
  topN: z.number().nullable(),
  teams: z.number().nullable().optional(),
  query: wireQuery.nullable().optional(),
  visibleTo: z.enum(VISIBILITY).nullable(),
});

/** Drops fields that don't apply to the input's kind, so a harmless extra from the model can't fail validation. */
export function normalizeInput(i: z.infer<typeof wireInput>): ComposeInput {
  const k = i.kind;
  return {
    id: i.id,
    kind: k,
    label: i.label,
    required: i.required ?? false,
    options: k === "choice" || k === "slot" || k === "rank" ? (i.options?.map((o) => ({ id: o.id, label: o.label, price: o.price ?? null })) ?? null) : null,
    multi: k === "choice" || k === "person" ? (i.multi ?? false) : null,
    capacity: k === "slot" && i.capacity ? Math.round(i.capacity) : null,
    min: k === "number" ? i.min : null,
    max: k === "number" || k === "rating" || k === "text" || k === "rank" ? i.max : null,
    unit: k === "number" && i.unit ? i.unit : null,
    showIf: i.showIf ?? null,
    timeLimitSec: i.timeLimitSec ? Math.round(i.timeLimitSec) : null,
  };
}
export function normalizeView(v: z.infer<typeof wireView>): ComposeView {
  return {
    id: v.id,
    kind: v.kind,
    title: v.title || null,
    source: v.kind === "table" || v.kind === "teams" || v.kind === "summary" ? null : v.source || null,
    op: v.kind === "stat" ? (v.op ?? "count") : v.kind === "leaderboard" ? (v.op ?? null) : null,
    topN: v.kind === "leaderboard" && v.topN ? Math.round(v.topN) : null,
    teams: v.kind === "teams" && v.teams ? Math.round(v.teams) : null,
    // Parsed and checked by AppSpecSchema (names, columns, sizes) like a hand-written query.
    query: (v.kind === "summary" && v.query ? wireToQuery(v.query) : null) as ComposeView["query"],
    visibleTo: v.visibleTo ?? "everyone",
  };
}
