// Ranked choice: a ballot is an ordered list of distinct options (top N), and the ranking view adds
// Borda points (1st of N = N points … unranked = 0), most points first, ties broken by first choices.
import { describe, expect, it } from "vitest";
import { AppSpecSchema, type ComposeBlock } from "@/engine/app-spec/app-spec-schema";
import { exampleRankedChoice } from "@/engine/app-spec/app-spec-examples-compose-ranking";
import type { AnswerRow, AppRuntime } from "@/engine/blocks/block-definition-types";
import { composeBlock, type ComposePayload } from "@/engine/blocks/compose/compose-block";
import { computeComposeResults } from "@/engine/blocks/compose/compose-results";

const runtime: AppRuntime = { openQuestionId: null, revealedQuestionIds: [] };
const block = AppSpecSchema.parse(structuredClone(exampleRankedChoice)).blocks[0] as ComposeBlock;
const check = (order: unknown) => composeBlock.validate(block, { kind: "compose", values: { order: order as string[] } }, { itemId: "", runtime });
const ballot = (who: string, order: string[], at: number): AnswerRow<ComposePayload> => ({
  blockId: block.id,
  itemId: "",
  participantHash: who.repeat(64),
  displayName: who,
  payload: { kind: "compose", values: { order } },
  createdAt: at,
});

describe("ranked choice", () => {
  it("accepts an ordered top-N ballot of distinct options only", () => {
    expect(check(["o2", "o1", "o5"])).toBeNull();
    expect(check(["o4"])).toBeNull();
    expect(check(["o1", "o2", "o3", "o4"])).toBe("bad_payload"); // more than the top 3
    expect(check(["o1", "o1"])).toBe("bad_payload");
    expect(check(["o9"])).toBe("bad_payload");
    expect(check("o1")).toBe("bad_payload");
  });

  it("adds Borda points: 1st = 3, 2nd = 2, 3rd = 1; ties broken by first choices", () => {
    const answers = [ballot("a", ["o1", "o2", "o3"], 1), ballot("b", ["o2", "o1", "o4"], 2), ballot("c", ["o2", "o3"], 3)];
    const view = computeComposeResults(block, answers, { appStatus: "active", runtime, viewer: { isHost: true, participantHash: null } }).views[0];
    expect(view).toMatchObject({ kind: "ranking", voters: 3 });
    if (view.kind !== "ranking") return;
    // o2: 2+3+3 = 8 · o1: 3+2 = 5 · o3: 1+2 = 3 · o4: 1 · o5: 0
    expect(view.items.map((i) => [i.id, i.points, i.first])).toEqual([
      ["o2", 8, 2],
      ["o1", 5, 1],
      ["o3", 3, 0],
      ["o4", 1, 0],
      ["o5", 0, 0],
    ]);
  });

  it("rejects a top-N larger than the options", () => {
    const tooMany = structuredClone(exampleRankedChoice);
    ((tooMany.blocks[0] as { inputs: Array<{ max: number }> }).inputs[0]).max = 9;
    expect(AppSpecSchema.safeParse(tooMany).success).toBe(false);
  });
});
