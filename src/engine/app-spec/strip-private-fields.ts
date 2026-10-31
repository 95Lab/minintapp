// Participants must never receive secrets such as a quiz answer before it is revealed. Each brick
// decides what is private via its optional `stripPrivate` (see block-registry.ts).
import type { AppSpec, Block, QuizBlock, QuizQuestion } from "./app-spec-schema";
import { blockDefinition } from "@/engine/blocks/block-registry";

export type PublicQuizBlock = Omit<QuizBlock, "questions"> & {
  questions: Array<Omit<QuizQuestion, "correct"> & { correct: string | null }>;
};
export type PublicBlock = Exclude<Block, { type: "quiz" }> | PublicQuizBlock;
export type PublicAppSpec = Omit<AppSpec, "blocks"> & { blocks: PublicBlock[] };

/** Copy of the spec with private fields hidden; quiz `correct` kept only for revealed questions. */
export function stripPrivateFields(spec: AppSpec, revealedQuestionIds: ReadonlySet<string>): PublicAppSpec {
  return {
    ...spec,
    blocks: spec.blocks.map((block) => {
      const strip = blockDefinition(block.type).stripPrivate;
      return (strip ? strip(block, revealedQuestionIds) : block) as PublicBlock;
    }),
  };
}
