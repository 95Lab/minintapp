// Preset: choice — poll / vote. Expands to compose: one choice input + a bar chart that each
// participant sees after voting (or after the app closes).
import { z } from "zod";
import { Id, jsonNullableBoolean, jsonNullableEnum, jsonNullableOptions, jsonNullableString, OptionSchema, Text, wireOption } from "../block-schema-primitives";
import type { PresetDefinition } from "./preset-definition-types";

export const ChoiceBlockSchema = z.object({
  type: z.literal("choice"),
  id: Id,
  question: Text,
  options: z
    .array(OptionSchema)
    .min(2)
    .max(10)
    .refine((opts) => new Set(opts.map((o) => o.id)).size === opts.length, "option ids must be unique"),
  multi: z.boolean(),
  showResults: z.enum(["live", "after_vote", "after_close"]),
});
export type ChoiceBlock = z.infer<typeof ChoiceBlockSchema>;

/** Input / view ids inside the expanded compose block (scripts and remix rely on them). */
export const CHOICE_INPUT_ID = "vote";

export const choicePreset: PresetDefinition<ChoiceBlock> = {
  type: "choice",
  label: { vi: "Bình chọn", en: "Poll" },
  promptDoc: `choice — bình chọn: question, options (2–10, {id,label}), multi (chọn nhiều hay không),
   showResults ("live" | "after_vote" | "after_close").`,
  promptRules: `- "mỗi người 1 phiếu" / "one vote each" (mặc định) → multi: false; "chọn nhiều" / "multiple" → multi: true.
- "ẩn kết quả tới khi đóng" / "hide results until closed" → showResults: "after_close";
  "hiện kết quả sau khi bình chọn" / "after voting" → "after_vote"; mặc định / "live results" → "live".`,
  specSchema: ChoiceBlockSchema,
  llmFields: {
    question: { json: jsonNullableString, wire: z.string().nullable() },
    options: { json: jsonNullableOptions, wire: z.array(wireOption).nullable() },
    multi: { json: jsonNullableBoolean, wire: z.boolean().nullable() },
    showResults: { json: jsonNullableEnum(["live", "after_vote", "after_close"]), wire: z.enum(["live", "after_vote", "after_close"]).nullable() },
  },
  fromFlat: (f) => ({
    type: "choice",
    id: f.id,
    question: (f.question as string) ?? "",
    options: (f.options as ChoiceBlock["options"]) ?? [],
    multi: (f.multi as boolean) ?? false,
    showResults: (f.showResults as ChoiceBlock["showResults"]) ?? "live",
  }),
  toFlat: (b) => ({ question: b.question, options: b.options, multi: b.multi, showResults: b.showResults }),

  expand: (b) => ({
    type: "compose",
    id: b.id,
    title: b.question,
    note: null,
    inputs: [
      {
        id: CHOICE_INPUT_ID,
        kind: "choice",
        label: b.question,
        required: true,
        options: b.options.map((o) => ({ ...o, price: null })),
        multi: b.multi,
        capacity: null,
        min: null,
        max: null,
        unit: null,
        showIf: null,
        timeLimitSec: null,
      },
    ],
    // "live" and "after_vote" both showed the chart only once you had voted (no bandwagon effect).
    entries: "one",
    flow: "open",
    views: [{ id: "results", kind: "bars", title: null, source: CHOICE_INPUT_ID, op: null, topN: null, teams: null, query: null, visibleTo: b.showResults === "after_close" ? "after_close" : "after_submit" }],
  }),
};
