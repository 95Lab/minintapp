import { z } from "zod";
import { Id, Text, OptionSchema } from "../block-schema-primitives";
// Initial shared contract: advanced query, roster and custom code are intentionally not accepted yet.
export const INPUT_KINDS = ["text", "number", "choice", "rating", "slot", "date", "datetime"] as const;
export const VIEW_KINDS = ["bars", "stat", "table", "leaderboard", "cloud"] as const;
export const STAT_OPS = ["count", "sum", "avg", "min", "max"] as const;
export const VISIBILITY = ["everyone", "after_submit", "after_step", "after_close", "host"] as const;
export const ComposeOptionSchema = OptionSchema.extend({ price: z.number().min(0).max(1e9).nullable() });
export const ComposeInputSchema = z.strictObject({
  id: Id, kind: z.enum(INPUT_KINDS), label: Text, required: z.boolean(),
  options: z.array(ComposeOptionSchema).min(2).max(20).nullable(), multi: z.boolean().nullable(),
  capacity: z.number().int().min(1).max(500).nullable(),
  min: z.number().min(-1e12).max(1e12).nullable(), max: z.number().min(-1e12).max(1e12).nullable(),
  unit: z.string().min(1).max(12).nullable(),
  showIf: z.strictObject({ input: Id, equals: Id }).nullable(),
  timeLimitSec: z.number().int().min(5).max(600).nullable(),
});
export const ComposeViewSchema = z.strictObject({
  id: Id, kind: z.enum(VIEW_KINDS), title: Text.nullable(), source: Id.nullable(),
  op: z.enum(STAT_OPS).nullable(), topN: z.number().int().min(1).max(50).nullable(),
  teams: z.null(), query: z.null(), visibleTo: z.enum(VISIBILITY),
});
export const ComposeValueSchema = z.union([z.string().max(200), z.number().finite(), z.array(Id).max(20)]);
export const ComposePayloadSchema = z.strictObject({
  kind: z.literal("compose"), values: z.record(Id, ComposeValueSchema).refine((v) => Object.keys(v).length <= 8),
});
export type ComposeInput = z.infer<typeof ComposeInputSchema>;
export type ComposeView = z.infer<typeof ComposeViewSchema>;
export type ComposePayload = z.infer<typeof ComposePayloadSchema>;
