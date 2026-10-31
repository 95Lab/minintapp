import type { AppSpec } from "./app-spec-schema";
import type { QuizBlock } from "@/lib/blocks/quiz/quiz-block";
import type { AppRuntime } from "@/lib/blocks/block-definition-types";
type PublicQuiz = Omit<QuizBlock, "questions"> & { questions: Array<Omit<QuizBlock["questions"][number], "correct"> & { correct: string | null }> };
export type PublicAppSpec = Omit<AppSpec, "blocks"> & { blocks: Array<Exclude<AppSpec["blocks"][number], QuizBlock> | PublicQuiz> };
export function stripPrivateFields(spec: AppSpec, runtime: AppRuntime): PublicAppSpec {
  const copy = structuredClone(spec);
  return { ...copy, blocks: copy.blocks.map((b) => b.type === "quiz" ? {
    ...b, questions: b.questions.map((q) => ({ ...q, correct: runtime.revealedQuestionIds.includes(q.id) ? q.correct : null })),
  } : b) };
}
