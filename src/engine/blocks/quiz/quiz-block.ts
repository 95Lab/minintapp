// Brick: quiz — host-driven questions with server-side scoring and a leaderboard. Participants
// never receive `correct` before the host reveals a question.
import { z } from "zod";
import { resultLabels } from "@/engine/i18n/result-labels-vi-en";
import type { BlockDefinition } from "../block-definition-types";
import { Id, jsonNullableBoolean, jsonOption, OptionSchema, Text, wireOption } from "../block-schema-primitives";

export const QuizQuestionSchema = z.object({
  id: Id,
  prompt: Text,
  options: z.array(OptionSchema).min(2).max(6),
  correct: Id,
  points: z.number().int().min(0).max(1000),
  timeLimitSec: z.number().int().min(0).max(300),
}).superRefine((q,ctx)=>{
 if(new Set(q.options.map(o=>o.id)).size!==q.options.length)ctx.addIssue({code:"custom",path:["options"],message:"Option ids must be unique"});
 if(!q.options.some(o=>o.id===q.correct))ctx.addIssue({code:"custom",path:["correct"],message:"Correct answer must reference an option"});
});
export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;

export const QuizBlockSchema = z.object({
  type: z.literal("quiz"),
  id: Id,
  questions: z.array(QuizQuestionSchema).min(1).max(20),
  leaderboard: z.boolean(),
});
export type QuizBlock = z.infer<typeof QuizBlockSchema>;

export const QuizPayloadSchema = z.object({ kind: z.literal("quiz"), optionId: Id }).strict();
export type QuizPayload = z.infer<typeof QuizPayloadSchema>;

export interface QuizResults {
  type: "quiz";
  blockId: string;
  answeredByQuestion: Record<string, number>;
  /** option counts per question; only for the host or for revealed questions */
  countsByQuestion: Record<string, Record<string, number>>;
  leaderboard: Array<{ name: string; score: number }>;
}


const jsonQuizQuestion = {
  type: "object",
  properties: {
    id: { type: "string" },
    prompt: { type: "string" },
    options: { type: "array", items: jsonOption },
    correct: { type: "string" },
    points: { type: "integer" },
    timeLimitSec: { type: "integer" },
  },
  required: ["id", "prompt", "options", "correct", "points", "timeLimitSec"],
  additionalProperties: false,
};
const wireQuizQuestion = z.object({ id: z.string(), prompt: z.string(), options: z.array(wireOption), correct: z.string(), points: z.number(), timeLimitSec: z.number() });

export const quizBlock: BlockDefinition<QuizBlock, QuizPayload, QuizResults> = {
  type: "quiz",
  label: { vi: "Quiz có xếp hạng", en: "Quiz with leaderboard" },
  promptDoc: `quiz — trắc nghiệm có tính điểm: questions (1–20 câu, mỗi câu {id,prompt,options 2–6,correct,
   points,timeLimitSec}), leaderboard (bảng xếp hạng).`,
  promptRules: `- "quiz" / "trắc nghiệm" / "đố vui" (host mở từng câu, đếm giờ) → quiz, leaderboard: true trừ khi người dùng nói không cần;
  timeLimitSec theo yêu cầu (mặc định 20); points mặc định 100 mỗi câu.`,

  specSchema: QuizBlockSchema,
  payloadSchema: QuizPayloadSchema,

  llmFields: {
    questions: { json: { anyOf: [{ type: "array", items: jsonQuizQuestion }, { type: "null" }] }, wire: z.array(wireQuizQuestion).nullable() },
    leaderboard: { json: jsonNullableBoolean, wire: z.boolean().nullable() },
  },
  fromFlat: (f) => ({ type: "quiz", id: f.id, questions: (f.questions as QuizQuestion[]) ?? [], leaderboard: (f.leaderboard as boolean) ?? false }),
  toFlat: (b) => ({ questions: b.questions, leaderboard: b.leaderboard }),

  validate(block, p, { itemId, runtime }) {
    const q = block.questions.find((x) => x.id === itemId);
    if (!q || !q.options.some((o) => o.id === p.optionId)) return "bad_payload";
    const open = runtime.openQuestionId === q.id && !runtime.revealedQuestionIds.includes(q.id);
    return open ? null : "question_closed";
  },

  computeResults(block, rows, { runtime, viewer, locale }) {
    const anonymous = resultLabels(locale).anonymous;
    const revealed = new Set(runtime.revealedQuestionIds);
    const answeredByQuestion: Record<string, number> = {};
    const countsByQuestion: Record<string, Record<string, number>> = {};
    const scores = new Map<string, { name: string; score: number }>();
    for (const q of block.questions) {
      answeredByQuestion[q.id] = 0;
      if (viewer.isHost || revealed.has(q.id)) countsByQuestion[q.id] = Object.fromEntries(q.options.map((o) => [o.id, 0]));
    }
    for (const r of rows) {
      const q = block.questions.find((x) => x.id === r.itemId);
      if (!q) continue;
      answeredByQuestion[q.id] += 1;
      const counts = countsByQuestion[q.id];
      if (counts && r.payload.optionId in counts) counts[r.payload.optionId] += 1;
      const entry = scores.get(r.participantHash) ?? { name: r.displayName || anonymous, score: 0 };
      if (revealed.has(q.id) && r.payload.optionId === q.correct) entry.score += q.points;
      scores.set(r.participantHash, entry);
    }
    const leaderboard = block.leaderboard ? [...scores.values()].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, 10) : [];
    return { type: "quiz", blockId: block.id, answeredByQuestion, countsByQuestion, leaderboard };
  },

  summarizeForRemix: (block) => `Quiz: ${block.questions.length} câu`,

  security: {
    inputLabels: () => [],
    // Options are tap-only buttons; security-awareness quizzes legitimately use wrong answers like
    // "Share your password with IT" — so quiz text is never "instruction" text (recorded only).
    instructionTexts: () => [],
    allTexts: (b) => b.questions.flatMap((q) => [q.prompt, ...q.options.map((o) => o.label)]),
  },

  stripPrivate: (block, revealed) => ({
    ...block,
    questions: block.questions.map((q) => ({ ...q, correct: revealed.has(q.id) ? q.correct : null })),
  }),

  hostActions: {
    open(block, runtime, { args }) {
      const questionId = String(args.questionId ?? "");
      if (!block.questions.some((q) => q.id === questionId)) return { ok: false, error: "question_not_found" };
      return { ok: true, runtime: { ...runtime, openQuestionId: questionId, revealedQuestionIds: runtime.revealedQuestionIds.filter((q) => q !== questionId) } };
    },
    reveal(block, runtime, { args }) {
      const questionId = String(args.questionId ?? "");
      if (!block.questions.some((q) => q.id === questionId)) return { ok: false, error: "question_not_found" };
      const revealed = runtime.revealedQuestionIds.includes(questionId) ? runtime.revealedQuestionIds : [...runtime.revealedQuestionIds, questionId];
      return { ok: true, runtime: { ...runtime, revealedQuestionIds: revealed } };
    },
  },

  sampleAnswer(block, runtime, random) {
    const q = block.questions.find((x) => x.id === runtime.openQuestionId);
    if (!q || runtime.revealedQuestionIds.includes(q.id)) return null;
    const optionId = random() < 0.6 ? q.correct : q.options[Math.floor(random() * q.options.length)].id;
    return { itemId: q.id, payload: { kind: "quiz", optionId } };
  },
};
