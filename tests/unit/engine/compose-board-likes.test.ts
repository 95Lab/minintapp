// Board view: people post entries and like other people's entries; most liked first. Likes are records
// ("l-<entry id>"), validated, counted once per person, never on one's own entry, and removable.
import { describe, expect, it } from "vitest";
import { AppSpecSchema, type ComposeBlock } from "@/engine/app-spec/app-spec-schema";
import { exampleQnaBoard } from "@/engine/app-spec/app-spec-examples-compose-board";
import { exampleTripSplit } from "@/engine/app-spec/app-spec-examples-compose";
import type { AnswerRow, AppRuntime } from "@/engine/blocks/block-definition-types";
import { composeBlock, type ComposePayload } from "@/engine/blocks/compose/compose-block";
import { entryIdOf } from "@/engine/blocks/compose/compose-atoms-schema";
import { computeComposeResults } from "@/engine/blocks/compose/compose-results";

const runtime: AppRuntime = { openQuestionId: null, revealedQuestionIds: [] };
const board = AppSpecSchema.parse(structuredClone(exampleQnaBoard)).blocks[0] as ComposeBlock;
const hash = (c: string) => c.repeat(64);
let at = 0;
const answer = (who: string, itemId: string, payload: Omit<ComposePayload, "kind">): AnswerRow<ComposePayload> => ({
  blockId: board.id,
  itemId,
  participantHash: hash(who),
  displayName: who.toUpperCase(),
  payload: { kind: "compose", ...payload },
  createdAt: (at += 1),
});
const post = (who: string, n: number, text: string) => answer(who, `e-${who}${n}aaaaaa`, { values: { question: text } });
const like = (who: string, author: string, n: number) => answer(who, `l-${entryIdOf(hash(author), `e-${author}${n}aaaaaa`)}`, { values: {}, like: true });
const check = (block: ComposeBlock, itemId: string, payload: Omit<ComposePayload, "kind">) => composeBlock.validate(block, { kind: "compose", ...payload }, { itemId, runtime });

describe("board likes", () => {
  it("accepts a like or unlike only as an empty record with a like itemId, on blocks that have a board", () => {
    const id = `l-${entryIdOf(hash("a"), "e-a1aaaaaa")}`;
    expect(check(board, id, { values: {}, like: true })).toBeNull();
    expect(check(board, id, { values: {}, removed: true })).toBeNull();
    expect(check(board, id, { values: { question: "x" }, like: true })).toBe("bad_payload");
    expect(check(board, "l-nothex", { values: {}, like: true })).toBe("bad_payload");
    expect(check(board, id, { values: {}, like: true, removed: true })).toBe("bad_payload");
    const noBoard = AppSpecSchema.parse(structuredClone(exampleTripSplit)).blocks[0] as ComposeBlock;
    expect(check(noBoard, id, { values: {}, like: true })).toBe("bad_payload");
  });

  it("ranks entries by likes, one per person, ignoring self-likes and removed likes, with the viewer's flags", () => {
    const answers = [
      post("a", 1, "Bao giờ có bản mobile?"),
      post("b", 1, "Giá bao nhiêu?"),
      post("a", 2, "Có API không?"),
      like("b", "a", 2),
      like("c", "a", 2),
      like("c", "b", 1),
      like("a", "a", 1), // self-like: ignored
      answer("c", `l-${entryIdOf(hash("b"), "e-b1aaaaaa")}`, { values: {}, removed: true }), // c's like on b1, later removed
    ];
    // the store keeps one record per (item, person): the removal replaced c's like on b1
    const stored = answers.filter((a, i) => !(i === 5));
    const results = computeComposeResults(board, stored, { appStatus: "active", runtime, viewer: { isHost: false, participantHash: hash("c") } });
    const view = results.views[0];
    expect(view.kind).toBe("board");
    if (view.kind !== "board") return;
    expect(view.items.map((i) => [i.text, i.likes, i.liked, i.mine])).toEqual([
      ["Có API không?", 2, true, false],
      ["Bao giờ có bản mobile?", 0, false, false],
      ["Giá bao nhiêu?", 0, false, false],
    ]);
    // likes are not entries: the submission count is the 3 posts
    expect(results.submissions).toBe(3);
  });

  it("is only allowed where entries are open to everyone (not in host-paced steps)", () => {
    const steps = { ...structuredClone(exampleQnaBoard), blocks: [{ ...(structuredClone(exampleQnaBoard).blocks[0] as object), entries: "one", flow: "steps" }] };
    expect(AppSpecSchema.safeParse(steps).success).toBe(false);
  });

  it("caps likes and entries separately: liking never eats into the entry cap", async () => {
    const { appsRepository, resetMemoryStore } = await import("@/engine/db/apps-repository");
    resetMemoryStore();
    const repo = appsRepository();
    const { app } = await repo.createApp({ spec: AppSpecSchema.parse(structuredClone(exampleQnaBoard)), prompt: "t", lifetimeMs: 3_600_000 });
    const base = { blockId: board.id, participantHash: hash("z"), displayName: "Z" };
    for (let i = 0; i < 3; i++) {
      const outcome = await repo.submitResponse(app.id, { ...base, itemId: `l-${entryIdOf(hash(String(i)), "e-x1aaaaaa")}`, payload: { kind: "compose", values: {}, like: true } }, { maxRowsPerParticipant: 3 });
      expect(outcome).toBe("ok");
    }
    // three likes held; an entry under a cap of 3 still goes in
    expect(await repo.submitResponse(app.id, { ...base, itemId: "e-z1aaaaaa", payload: { kind: "compose", values: { question: "q" } } }, { maxRowsPerParticipant: 3 })).toBe("ok");
    // a 4th like is refused by the like cap
    expect(await repo.submitResponse(app.id, { ...base, itemId: `l-${entryIdOf(hash("9"), "e-x1aaaaaa")}`, payload: { kind: "compose", values: {}, like: true } }, { maxRowsPerParticipant: 3 })).toBe("limit");
  });
});
