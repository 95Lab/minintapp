// Preset: open_text — short free-text answers shown as a word cloud ("one word about today").
// Expands to compose: one text input with a word limit + a cloud view.
import { z } from "zod";
import { Id, jsonNullableEnum, jsonNullableInteger, jsonNullableString, Text } from "../block-schema-primitives";
import type { PresetDefinition } from "./preset-definition-types";

export const OpenTextBlockSchema = z.object({
  type: z.literal("open_text"),
  id: Id,
  question: Text,
  maxWords: z.number().int().min(1).max(8),
  showResults: z.enum(["live", "after_close"]),
});
export type OpenTextBlock = z.infer<typeof OpenTextBlockSchema>;

export const OPEN_TEXT_INPUT_ID = "answer";

export const openTextPreset: PresetDefinition<OpenTextBlock> = {
  type: "open_text",
  label: { vi: "Word cloud / trả lời ngắn", en: "Word cloud / short answer" },
  promptDoc: `open_text — trả lời ngắn gom thành word cloud: question, maxWords (1–8 chữ mỗi câu trả lời, mặc định 3),
   showResults ("live" | "after_close").`,
  promptRules: `- "một từ" / "cảm nhận" / "word cloud" / "brainstorm" / "ý kiến ngắn" → open_text; "một từ" → maxWords: 1.`,
  specSchema: OpenTextBlockSchema,
  llmFields: {
    question: { json: jsonNullableString, wire: z.string().nullable() },
    maxWords: { json: jsonNullableInteger, wire: z.number().nullable() },
    showResults: { json: jsonNullableEnum(["live", "after_vote", "after_close"]), wire: z.enum(["live", "after_vote", "after_close"]).nullable() },
  },
  fromFlat: (f) => ({
    type: "open_text",
    id: f.id,
    question: (f.question as string) ?? "",
    maxWords: Math.min(8, Math.max(1, Math.round((f.maxWords as number) ?? 3))),
    showResults: f.showResults === "after_close" ? "after_close" : "live",
  }),
  toFlat: (b) => ({ question: b.question, maxWords: b.maxWords, showResults: b.showResults }),

  expand: (b) => ({
    type: "compose",
    id: b.id,
    title: b.question,
    note: null,
    inputs: [{ id: OPEN_TEXT_INPUT_ID, kind: "text", label: b.question, required: true, options: null, multi: null, capacity: null, min: null, max: b.maxWords, unit: null, showIf: null, timeLimitSec: null }],
    entries: "one",
    flow: "open",
    views: [{ id: "cloud", kind: "cloud", title: null, source: OPEN_TEXT_INPUT_ID, op: null, topN: null, teams: null, query: null, visibleTo: b.showResults === "after_close" ? "after_close" : "after_submit" }],
  }),
};
