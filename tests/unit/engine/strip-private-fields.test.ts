import { describe, it, expect } from "vitest";
import { stripPrivateFields } from "@/engine/app-spec/strip-private-fields";
import { examplePasswordQuiz as quizDraft } from "@/engine/app-spec/app-spec-examples";
import { runtimeSpec } from "./runtime-spec-test-helper";

const examplePasswordQuiz = runtimeSpec(quizDraft);

describe("stripPrivateFields", () => {
  it("hides correct answers when not revealed", () => {
    const spec = examplePasswordQuiz;
    const revealed = new Set<string>();

    const result = stripPrivateFields(spec, revealed);

    // All quiz questions should have correct = null
    for (const block of result.blocks) {
      if (block.type === "quiz") {
        for (const q of block.questions) {
          expect(q.correct).toBeNull();
        }
      }
    }
  });

  it("shows correct answers for revealed questions", () => {
    const spec = examplePasswordQuiz;
    const revealedQuestion = spec.blocks
      .filter((b) => b.type === "quiz")[0]
      ?.questions?.[0]?.id;

    expect(revealedQuestion).toBeDefined();

    const revealed = new Set([revealedQuestion!]);
    const result = stripPrivateFields(spec, revealed);

    // First question should show correct
    const quizBlock = result.blocks.find((b) => b.type === "quiz");
    if (quizBlock?.type === "quiz") {
      const firstQuestion = quizBlock.questions[0];
      expect(firstQuestion.correct).not.toBeNull();
    }
  });

  it("preserves non-quiz blocks unchanged", () => {
    const spec = examplePasswordQuiz;
    const revealed = new Set<string>();

    const result = stripPrivateFields(spec, revealed);

    expect(result.locale).toBe(spec.locale);
    expect(result.title).toBe(spec.title);
    expect(result.description).toBe(spec.description);
    expect(result.requireName).toBe(spec.requireName);
  });

  it("does not modify original spec", () => {
    const spec = examplePasswordQuiz;
    const revealed = new Set<string>();
    const originalCorrect = spec.blocks
      .filter((b) => b.type === "quiz")[0]
      ?.questions?.[0]?.correct;

    stripPrivateFields(spec, revealed);

    const currentCorrect = spec.blocks
      .filter((b) => b.type === "quiz")[0]
      ?.questions?.[0]?.correct;

    expect(currentCorrect).toBe(originalCorrect);
  });
});
