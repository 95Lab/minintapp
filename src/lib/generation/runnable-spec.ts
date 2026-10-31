import { z } from "zod";
import { AppSpecSchema, type AppSpec } from "@/lib/app-spec/app-spec-schema";
// A deliberately narrower wire shape than the full planned compose contract.
const Option = z.strictObject({ id: z.string(), label: z.string() });
const PollInput = z.strictObject({
  id: z.string(), kind: z.literal("choice"), label: z.string(), required: z.literal(true),
  options: z.array(Option.extend({ price: z.null() })), multi: z.literal(false),
  capacity: z.null(), min: z.null(), max: z.null(), unit: z.null(), showIf: z.null(), timeLimitSec: z.null(),
});
const PollView = z.strictObject({
  id: z.string(), kind: z.literal("bars"), title: z.string().nullable(), source: z.string(),
  op: z.null(), topN: z.null(), teams: z.null(), query: z.null(),
  visibleTo: z.enum(["everyone", "after_submit", "after_close", "host"]),
});
const Poll = z.strictObject({ type: z.literal("compose"), id: z.string(), title: z.string(), note: z.string().nullable(), entries: z.literal("one"), flow: z.literal("open"), inputs: z.array(PollInput).length(1), views: z.array(PollView).min(1).max(4) });
const Quiz = z.strictObject({ type: z.literal("quiz"), id: z.string(), leaderboard: z.boolean(), questions: z.array(z.strictObject({ id: z.string(), prompt: z.string(), options: z.array(Option), correct: z.string(), points: z.number().int(), timeLimitSec: z.number().int() })) });
const Wheel = z.strictObject({ type: z.literal("wheel"), id: z.string(), title: z.string(), source: z.enum(["options", "participants"]), options: z.array(Option), removeWinner: z.boolean() });
export const GenerationWireSchema = z.strictObject({ ...AppSpecSchema.shape, blocks: z.array(z.discriminatedUnion("type", [Poll, Quiz, Wheel])).min(1).max(6) });
const unsafeText = /https?:\/\/|www\.|<\/?[a-z][^>]*>|javascript:|data:text\/html/i;
export function validateRunnableSpec(value: unknown): { spec: AppSpec; issues: [] } | { spec: null; issues: string[] } {
  const shape = GenerationWireSchema.safeParse(value);
  if (!shape.success) return { spec: null, issues: shape.error.issues.slice(0, 8).map((i) => `Unsupported configuration at ${i.path.join(".")}`) };
  const parsed = AppSpecSchema.safeParse(shape.data);
  if (!parsed.success) return { spec: null, issues: parsed.error.issues.slice(0, 8).map((i) => `${i.path.join(".")}: ${i.message}`) };
  // The supported poll shape guarantees fields/results can be handled by the current server.
  const texts = [parsed.data.title, parsed.data.description, ...parsed.data.blocks.flatMap((b) => b.type === "quiz" ? b.questions.flatMap((q) => [q.prompt, ...q.options.map((o) => o.label)]) : b.type === "wheel" ? [b.title, ...b.options.map((o) => o.label)] : [b.title, b.note, ...b.inputs.map((i) => i.label), ...b.inputs.flatMap((i) => i.options?.map((o) => o.label) ?? []), ...b.views.map((v) => v.title)])];
  if (texts.some((text) => text && unsafeText.test(text))) return { spec: null, issues: ["Use plain text only; HTML and external URLs are not supported."] };
  return { spec: parsed.data, issues: [] };
}
