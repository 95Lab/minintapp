import { z } from "zod";
import { Id, Text, OptionSchema, uniqueIds } from "../block-schema-primitives";
export const QuizQuestionSchema = z.strictObject({
  id: Id, prompt: Text, options: z.array(OptionSchema).min(2).max(6),
  correct: Id, points: z.number().int().min(0).max(1000), timeLimitSec: z.number().int().min(0).max(300),
}).refine((q) => uniqueIds(q.options) && q.options.some((o) => o.id === q.correct), {
  message: "Quiz options must have unique ids and contain the correct answer",
});
export const QuizBlockSchema = z.strictObject({
  type: z.literal("quiz"), id: Id, questions: z.array(QuizQuestionSchema).min(1).max(20), leaderboard: z.boolean(),
}).refine((b) => uniqueIds(b.questions), { message: "Duplicate question ids" });
export const QuizPayloadSchema = z.strictObject({ kind: z.literal("quiz"), optionId: Id });
export type QuizBlock = z.infer<typeof QuizBlockSchema>;
export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;
export type QuizPayload = z.infer<typeof QuizPayloadSchema>;
