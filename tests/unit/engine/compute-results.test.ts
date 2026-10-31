// Quiz results through the generic dispatcher. Polls, group orders and word clouds are compose at
// runtime — see preset-expansion-and-compose-results.test.ts.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { computeResults } from "@/engine/responses/compute-results";
import { appsRepository, resetMemoryStore, type AppRecord } from "@/engine/db/apps-repository";
import { examplePasswordQuiz } from "@/engine/app-spec/app-spec-examples";
import type { Viewer } from "@/engine/responses/compute-results";
import { runtimeSpec } from "./runtime-spec-test-helper";

describe("computeResults", () => {
  describe("quiz leaderboard", () => {
    let app: AppRecord;
    let repo = appsRepository();

    beforeEach(async () => {
      resetMemoryStore();
      repo = appsRepository();
      const { app: created } = await repo.createApp({ spec: runtimeSpec(examplePasswordQuiz), prompt: "test", lifetimeMs: 3600000 });
      app = created;
      if (app.spec.blocks[0]?.type === "quiz") {
        await repo.updateApp(app.id, { runtime: { openQuestionId: app.spec.blocks[0].questions[0]?.id ?? null, revealedQuestionIds: [] } });
        app = (await repo.findApp(app.id))!;
      }
    });

    afterEach(() => {
      resetMemoryStore();
    });

    it("shows leaderboard with participants and scores (0 until revealed)", async () => {
      const quizBlock = app.spec.blocks[0];
      if (quizBlock?.type === "quiz") {
        const question = quizBlock.questions[0];
        await repo.submitResponse(app.id, {
          blockId: quizBlock.id,
          itemId: question.id,
          participantHash: "participant-1",
          displayName: "Alice",
          payload: { kind: "quiz", optionId: question.correct },
        });

        // Without reveal, leaderboard shows participants with 0 points
        const responses = await repo.listResponses(app.id);
        const viewer: Viewer = { isHost: false, participantHash: "participant-1" };
        const results = computeResults(app, responses, viewer);
        const quizResult = results[0];

        expect(quizResult?.type).toBe("quiz");
        if (quizResult?.type === "quiz") {
          expect(quizResult.leaderboard.length).toBe(1);
          expect(quizResult.leaderboard[0].name).toBe("Alice");
          expect(quizResult.leaderboard[0].score).toBe(0);
        }
      }
    });

    it("shows leaderboard with scores after reveal", async () => {
      const quizBlock = app.spec.blocks[0];
      if (quizBlock?.type === "quiz") {
        const question = quizBlock.questions[0];
        await repo.submitResponse(app.id, {
          blockId: quizBlock.id,
          itemId: question.id,
          participantHash: "participant-1",
          displayName: "Alice",
          payload: { kind: "quiz", optionId: question.correct },
        });

        await repo.updateApp(app.id, { runtime: { openQuestionId: null, revealedQuestionIds: [question.id] } });
        app = (await repo.findApp(app.id))!;

        const responses = await repo.listResponses(app.id);
        const viewer: Viewer = { isHost: false, participantHash: "participant-1" };
        const results = computeResults(app, responses, viewer);
        const quizResult = results[0];

        expect(quizResult?.type).toBe("quiz");
        if (quizResult?.type === "quiz") {
          expect(quizResult.leaderboard.length).toBe(1);
          expect(quizResult.leaderboard[0].name).toBe("Alice");
          expect(quizResult.leaderboard[0].score).toBe(question.points);
        }
      }
    });

    it("participant never sees own correct answer before reveal", async () => {
      const quizBlock = app.spec.blocks[0];
      if (quizBlock?.type === "quiz") {
        const question = quizBlock.questions[0];
        const viewer: Viewer = { isHost: false, participantHash: "participant-1" };

        // Before reveal
        let responses = await repo.listResponses(app.id);
        const resultsBefore = computeResults(app, responses, viewer);
        const quizResult = resultsBefore[0];
        if (quizResult?.type === "quiz") {
          expect(quizResult.countsByQuestion[question.id]).toBeUndefined();
        }

        // After reveal
        await repo.updateApp(app.id, { runtime: { openQuestionId: null, revealedQuestionIds: [question.id] } });
        app = (await repo.findApp(app.id))!;
        responses = await repo.listResponses(app.id);
        const resultsAfter = computeResults(app, responses, viewer);
        const quizResultAfter = resultsAfter[0];
        if (quizResultAfter?.type === "quiz") {
          expect(quizResultAfter.countsByQuestion[question.id]).toBeDefined();
        }
      }
    });
  });

  it("isolates a block whose results throw: it gets null, the other blocks still compute", () => {
    const spec = runtimeSpec(examplePasswordQuiz);
    // A corrupted stored block (e.g. hand-edited row) that crashes its aggregator.
    const broken = { type: "compose", id: "broken", title: "x", note: null, entries: "one", flow: "open", inputs: null, views: null } as unknown as (typeof spec.blocks)[number];
    const app = { spec: { ...spec, blocks: [broken, ...spec.blocks] }, status: "active", runtime: { openQuestionId: null, revealedQuestionIds: [] } } as unknown as AppRecord;
    const results = computeResults(app, [], { isHost: true, participantHash: null });
    expect(results[0]).toBeNull();
    expect(results[1]).toMatchObject({ type: "quiz" });
  });
});
