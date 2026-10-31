import { describe, expect, it } from "vitest";
import { MemoryAppsRepository } from "@/lib/db/memory-apps-repository";
import { templateSpec } from "@/lib/templates/app-templates";
import { participantHashFor } from "@/lib/security/token-hashing";
import { computeResults, computeQuizResults, wheelCandidates } from "@/lib/responses/compute-results";
import { stripPrivateFields } from "@/lib/app-spec/strip-private-fields";
const quizResponse = (id: string, name: string, optionId = "a", itemId = "q1") => ({ blockId: "quiz-1", itemId, participantHash: participantHashFor(id, name), displayName: name, payload: { kind: "quiz" as const, optionId } });
const join = (id: string, name: string) => ({ blockId: "wheel", itemId: "", participantHash: participantHashFor(id, name), displayName: name, payload: { kind: "wheel" as const, join: true as const } });
async function fixture(templateId: string) {
  const repo = new MemoryAppsRepository();
  const created = await repo.createApp({ spec: templateSpec(templateId, "vi"), prompt: "test", lifetimeMs: 3600_000 });
  return { repo, ...created };
}
describe("quiz runtime", () => {
  it("blocks unopened, wrong-question and revealed answers; upserts before reveal", async () => {
    const { repo, app, hostToken } = await fixture("quiz-general");
    await expect(repo.submitResponse(app.id, quizResponse(app.id, "Lan"))).rejects.toMatchObject({ code: "question_closed" });
    await repo.blockAction(app.id, hostToken, { blockId: "quiz-1", action: "open", args: { questionId: "q1" } });
    await expect(repo.submitResponse(app.id, quizResponse(app.id, "Lan", "a", "q2"))).rejects.toMatchObject({ code: "question_closed" });
    await repo.submitResponse(app.id, quizResponse(app.id, "Lan", "b"));
    await repo.submitResponse(app.id, quizResponse(app.id, "Lan", "a"));
    expect(await repo.listResponses(app.id)).toHaveLength(1);
    await repo.blockAction(app.id, hostToken, { blockId: "quiz-1", action: "reveal", args: { questionId: "q1" } });
    await expect(repo.submitResponse(app.id, quizResponse(app.id, "Lan", "b"))).rejects.toMatchObject({ code: "question_closed" });
  });
  it("hides answer and option counts, then scores revealed questions with stable tie order", async () => {
    const { repo, app, hostToken } = await fixture("quiz-general");
    await repo.blockAction(app.id, hostToken, { blockId: "quiz-1", action: "open", args: { questionId: "q1" } });
    await repo.submitResponse(app.id, quizResponse(app.id, "Mai"));
    await repo.submitResponse(app.id, quizResponse(app.id, "An"));
    await repo.submitResponse(app.id, quizResponse(app.id, "Binh", "b"));
    const before = (await repo.snapshot(app.id))!;
    const block = app.spec.blocks[0]; if (block.type !== "quiz") throw Error();
    const hidden = computeQuizResults(block, before.responses, before.app.runtime, false, "vi");
    expect(hidden.countsByQuestion).toEqual({});
    expect(hidden.leaderboard.every((p) => p.score === 0)).toBe(true);
    expect(computeQuizResults(block, before.responses, before.app.runtime, true, "vi").countsByQuestion.q1).toEqual({ a: 2, b: 1 });
    const publicBlock = stripPrivateFields(app.spec, before.app.runtime).blocks[0]; if (publicBlock.type !== "quiz") throw Error();
    expect(publicBlock.questions.every((q) => q.correct === null)).toBe(true);
    await repo.blockAction(app.id, hostToken, { blockId: "quiz-1", action: "reveal", args: { questionId: "q1" } });
    const after = (await repo.snapshot(app.id))!;
    expect(computeQuizResults(block, after.responses, after.app.runtime, false, "vi").leaderboard).toEqual([{ name: "An", score: 100 }, { name: "Mai", score: 100 }, { name: "Binh", score: 0 }]);
    const revealed = stripPrivateFields(app.spec, after.app.runtime).blocks[0]; if (revealed.type !== "quiz") throw Error();
    expect(revealed.questions.map((q) => q.correct)).toEqual(["a", null]);
    await repo.blockAction(app.id, hostToken, { blockId: "quiz-1", action: "open", args: { questionId: "q1" } });
    const reopened = (await repo.snapshot(app.id))!;
    expect(computeQuizResults(block, reopened.responses, reopened.app.runtime, false, "vi").leaderboard.every((p) => p.score === 0)).toBe(true);
  });
});
describe("wheel runtime", () => {
  it("requires a name, rejects empty draws and unauthorized host actions", async () => {
    const { repo, app, hostToken } = await fixture("wheel-participants");
    await expect(repo.blockAction(app.id, hostToken, { blockId: "wheel", action: "spin" })).rejects.toMatchObject({ code: "wheel_no_entrants" });
    await expect(repo.submitResponse(app.id, { ...join(app.id, "Lan"), displayName: " " })).rejects.toMatchObject({ code: "invalid_request" });
    await expect(repo.blockAction(app.id, "wrong-token", { blockId: "wheel", action: "spin" })).rejects.toMatchObject({ code: "forbidden" });
    await repo.submitResponse(app.id, join(app.id, "Lan"));
    await repo.transition(app.id, hostToken, "close");
    await expect(repo.blockAction(app.id, hostToken, { blockId: "wheel", action: "spin" })).rejects.toMatchObject({ code: "app_closed" });
  });
  it("deduplicates joins, prevents repeat winners and resets the candidate pool", async () => {
    const { repo, app, hostToken } = await fixture("wheel-participants");
    await repo.submitResponse(app.id, join(app.id, "Lan"));
    await repo.submitResponse(app.id, join(app.id, "Lan"));
    await repo.submitResponse(app.id, join(app.id, "Mai"));
    await Promise.all([repo.blockAction(app.id, hostToken, { blockId: "wheel", action: "spin" }), repo.blockAction(app.id, hostToken, { blockId: "wheel", action: "spin" })]);
    const snapshot = (await repo.snapshot(app.id))!;
    const spins = snapshot.app.runtime.blocks.wheel.spins!;
    expect(new Set(spins.map((s) => s.entryId)).size).toBe(2);
    expect(new Set(spins.map((s) => s.label))).toEqual(new Set(["Lan", "Mai"]));
    await expect(repo.blockAction(app.id, hostToken, { blockId: "wheel", action: "spin" })).rejects.toMatchObject({ code: "wheel_no_entrants" });
    await repo.submitResponse(app.id, join(app.id, "Lan"));
    await expect(repo.blockAction(app.id, hostToken, { blockId: "wheel", action: "spin" })).rejects.toMatchObject({ code: "wheel_no_entrants" });
    await repo.blockAction(app.id, hostToken, { blockId: "wheel", action: "reset" });
    const reset = (await repo.snapshot(app.id))!;
    const block = app.spec.blocks[0]; if (block.type !== "wheel") throw Error();
    expect(wheelCandidates(block, reset.responses, reset.app.runtime)).toHaveLength(2);
    expect(reset.app.runtime.blocks.wheel.spins).toEqual([]);
  });
  it("retains winner exclusion beyond the 50-spin history limit", async () => {
    const { repo, app, hostToken } = await fixture("wheel-participants");
    await Promise.all(Array.from({ length: 55 }, (_, i) => repo.submitResponse(app.id, join(app.id, `Person${i}`))));
    for (let i = 0; i < 55; i++) await repo.blockAction(app.id, hostToken, { blockId: "wheel", action: "spin" });
    const snapshot = (await repo.snapshot(app.id))!;
    expect(snapshot.app.runtime.blocks.wheel.spins).toHaveLength(50);
    expect(new Set(snapshot.app.runtime.blocks.wheel.removedEntryIds).size).toBe(55);
    await expect(repo.blockAction(app.id, hostToken, { blockId: "wheel", action: "spin" })).rejects.toMatchObject({ code: "wheel_no_entrants" });
  });
  it("supports fixed-option draws without participant joins and removes runtime data on end", async () => {
    const { repo, app, hostToken } = await fixture("wheel-options");
    await expect(repo.submitResponse(app.id, join(app.id, "Lan"))).rejects.toMatchObject({ code: "invalid_request" });
    for (let i = 0; i < 3; i++) await repo.blockAction(app.id, hostToken, { blockId: "wheel", action: "spin" });
    await expect(repo.blockAction(app.id, hostToken, { blockId: "wheel", action: "spin" })).rejects.toMatchObject({ code: "wheel_empty" });
    const snapshot = (await repo.snapshot(app.id))!;
    expect(computeResults(app.spec, [], snapshot.app.runtime, false)[0]).toMatchObject({ type: "wheel", entries: [] });
    await repo.transition(app.id, hostToken, "end");
    expect((await repo.findApp(app.id))?.runtime.blocks).toEqual({});
  });
});
