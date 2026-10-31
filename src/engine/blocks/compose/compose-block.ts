// Brick: compose — an app assembled from small atoms (compose-atoms-schema.ts) instead of a preset
// widget: sign-up sheets with seats, star ratings, bill splitting, expense logs, people votes,
// random teams, host-paced steps with timers, conditional questions… Presets (poll, group order,
// word cloud) expand into it. This file wires the pieces into the brick registry contract:
//   answers → compose-answer-validation.ts   results → compose-results.ts
//   host actions / step + team state → compose-runtime-state.ts   AI shape → compose-llm-wire-fields.ts
import { z } from "zod";
import type { BlockDefinition } from "../block-definition-types";
import { Id, jsonNullableEnum, jsonNullableString, Text } from "../block-schema-primitives";
import { ComposeInputSchema, ComposePayloadSchema, ComposeViewSchema, ENTRY_MODES, FLOW_MODES, type ComposePayload } from "./compose-atoms-schema";
import { validateComposeAnswer } from "./compose-answer-validation";
import { jsonInput, jsonView, normalizeInput, normalizeView, wireInput, wireView } from "./compose-llm-wire-fields";
import { queryToWire } from "./compose-llm-query-wire";
import { COMPOSE_PROMPT_DOC, COMPOSE_PROMPT_RULES } from "./compose-prompt-docs";
import { computeComposeResults, summarizeComposeResults, type ComposeResults } from "./compose-results";
import { composeHostActions } from "./compose-runtime-state";
import { composeSampleAnswer } from "./compose-sample-answer";
import { composeWiringIssues } from "./compose-wiring-rules";
import { stringLiterals } from "./expression/expr-types";

const viewTexts = (v: ComposeBlock["views"][number]) => [
  ...(v.title ? [v.title] : []),
  ...[...(v.query?.measures ?? []), ...(v.query?.derived ?? [])].flatMap((c) => (c.label ? [c.label] : [])),
  // A derived column can print a literal string in every row.
  ...(v.query ? stringLiterals(v.query) : []),
];

export const ComposeBlockSchema = z
  .object({
    type: z.literal("compose"),
    id: Id,
    title: Text,
    note: Text.nullable(),
    entries: z.enum(ENTRY_MODES).default("one"),
    flow: z.enum(FLOW_MODES).default("open"),
    inputs: z.array(ComposeInputSchema).max(8),
    views: z.array(ComposeViewSchema).max(4),
  })
  .superRefine((block, ctx) => {
    for (const issue of composeWiringIssues(block)) ctx.addIssue({ code: "custom", path: issue.path, message: issue.message });
  });
export type ComposeBlock = z.infer<typeof ComposeBlockSchema>;
export { ComposePayloadSchema, type ComposePayload, type ComposeResults };

export const composeBlock: BlockDefinition<ComposeBlock, ComposePayload, ComposeResults> = {
  type: "compose",
  label: { vi: "Lắp ghép tự do", en: "Compose" },
  promptDoc: COMPOSE_PROMPT_DOC,
  promptRules: COMPOSE_PROMPT_RULES,

  specSchema: ComposeBlockSchema,
  payloadSchema: ComposePayloadSchema,

  llmFields: {
    title: { json: jsonNullableString, wire: z.string().nullable() },
    note: { json: jsonNullableString, wire: z.string().nullable() },
    entries: { json: jsonNullableEnum([...ENTRY_MODES]), wire: z.enum(ENTRY_MODES).nullable() },
    flow: { json: jsonNullableEnum([...FLOW_MODES]), wire: z.enum(FLOW_MODES).nullable() },
    inputs: { json: { anyOf: [{ type: "array", items: jsonInput }, { type: "null" }] }, wire: z.array(wireInput).nullable() },
    views: { json: { anyOf: [{ type: "array", items: jsonView }, { type: "null" }] }, wire: z.array(wireView).nullable() },
  },
  fromFlat: (f) => ({
    type: "compose",
    id: f.id,
    title: (f.title as string) ?? "",
    note: (f.note as string) || null,
    entries: (f.entries as ComposeBlock["entries"]) ?? "one",
    flow: (f.flow as ComposeBlock["flow"]) ?? "open",
    inputs: ((f.inputs as z.infer<typeof wireInput>[]) ?? []).map(normalizeInput),
    views: ((f.views as z.infer<typeof wireView>[]) ?? []).map(normalizeView),
  }),
  // Every key present (strict structured output), also for hand-written drafts that left defaults out.
  toFlat: (b) => ({
    title: b.title,
    note: b.note,
    entries: b.entries ?? "one",
    flow: b.flow ?? "open",
    inputs: b.inputs.map((i) => ({ ...i, showIf: i.showIf ?? null, timeLimitSec: i.timeLimitSec ?? null })),
    // A summary whose hand-written query goes beyond what the AI format can say is left out of what the model sees.
    views: b.views.flatMap((v) => {
      const query = v.kind === "summary" && v.query ? queryToWire(v.query) : null;
      if (v.kind === "summary" && !query) return [];
      return [{ ...v, teams: v.teams ?? null, query }];
    }),
  }),

  validate: validateComposeAnswer,
  computeResults: computeComposeResults,
  summarizeForRemix: summarizeComposeResults,

  security: {
    // Only text/number inputs are TYPED into; choices/slots/ratings/people/dates are picked, so their wording is instruction text.
    inputLabels: (b) => b.inputs.filter((i) => i.kind === "text" || i.kind === "number").map((i) => (i.unit ? `${i.label} ${i.unit}` : i.label)),
    instructionTexts: (b) => [
      b.title,
      ...(b.note ? [b.note] : []),
      ...b.inputs.filter((i) => i.kind !== "text" && i.kind !== "number").flatMap((i) => [i.label, ...(i.options ?? []).map((o) => o.label)]),
      // View titles and column labels are shown to everyone, so "Nhập mã OTP…" there is an instruction too.
      ...b.views.flatMap(viewTexts),
    ],
    allTexts: (b) => [
      b.title,
      ...(b.note ? [b.note] : []),
      ...b.inputs.flatMap((i) => [i.label, ...(i.unit ? [i.unit] : []), ...(i.options ?? []).map((o) => o.label)]),
      ...b.views.flatMap(viewTexts),
    ],
  },

  // A summary's query can hold answers ("q1 = b scores 10"): results are computed on the server, so no
  // screen needs it — it never leaves the server.
  stripPrivate: (b) => ({ ...b, views: b.views.map((v) => (v.query ? { ...v, query: null } : v)) }),

  hostActions: composeHostActions,
  sampleAnswer: composeSampleAnswer,
};
