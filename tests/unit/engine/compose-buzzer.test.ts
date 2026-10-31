// Buzzer: each buzz input is a round the host opens (steps flow); a press is the value 1, accepted only
// while its round is open; the fastest view orders the round's presses by server receive time and
// counts rounds won.
import { describe, expect, it } from "vitest";
import { AppSpecSchema, type ComposeBlock } from "@/engine/app-spec/app-spec-schema";
import { exampleBuzzer } from "@/engine/app-spec/app-spec-examples-compose-buzzer";
import type { AnswerRow, AppRuntime } from "@/engine/blocks/block-definition-types";
import { composeBlock, type ComposePayload } from "@/engine/blocks/compose/compose-block";
import { computeComposeResults } from "@/engine/blocks/compose/compose-results";

const block = AppSpecSchema.parse(structuredClone(exampleBuzzer)).blocks[0] as ComposeBlock;
const stepRuntime = (current: string | null, done: string[], epoch = 0): AppRuntime => ({
  openQuestionId: null,
  revealedQuestionIds: [],
  blocks: { [block.id]: { step: { current, openedAt: current ? Date.now() : null, done }, teams: null, epoch } },
});
const press = (who: string, round: string, at: number, epoch = 0): AnswerRow<ComposePayload> => ({
  blockId: block.id,
  itemId: `${round}~${epoch}`,
  participantHash: who.repeat(64),
  displayName: who.toUpperCase(),
  payload: { kind: "compose", values: { [round]: 1 } },
  createdAt: at,
});

describe("buzzer", () => {
  it("accepts a press (1) only in the open round", () => {
    const open = stepRuntime("round2", ["round1"]);
    const check = (itemId: string, v: unknown, runtime = open) => composeBlock.validate(block, { kind: "compose", values: { [itemId.split("~")[0]]: v as number } }, { itemId, runtime });
    expect(check("round2~0", 1)).toBeNull();
    expect(check("round2~0", 2)).toBe("bad_payload");
    expect(check("round2", 1)).toBe("bad_payload"); // a press always names its game
    expect(check("round1~0", 1)).toBe("question_closed");
    expect(check("round3~0", 1)).toBe("question_closed");
    // after a restart (epoch 1) a press for the old game is refused
    expect(check("round2~0", 1, stepRuntime("round2", [], 1))).toBe("question_closed");
    expect(check("round2~1", 1, stepRuntime("round2", [], 1))).toBeNull();
  });

  it("orders the open round's presses by receive time and counts rounds won", () => {
    const answers = [press("a", "round1", 1000), press("b", "round1", 1300), press("b", "round2", 5000), press("c", "round2", 5250), press("a", "round2", 5900)];
    const view = computeComposeResults(block, answers, { appStatus: "active", runtime: stepRuntime("round2", ["round1"]), viewer: { isHost: true, participantHash: null } }).views[0];
    expect(view).toMatchObject({ kind: "fastest", round: { id: "round2", label: "Vòng 2" } });
    if (view.kind !== "fastest") return;
    expect(view.order).toEqual([
      { name: "B", afterMs: 0 },
      { name: "C", afterMs: 250 },
      { name: "A", afterMs: 900 },
    ]);
    expect(view.wins).toEqual([
      { name: "A", rounds: 1 },
      { name: "B", rounds: 1 },
    ]);
  });

  it("starts clean after a restart: presses from the previous game don't count", () => {
    const answers = [press("a", "round1", 1000, 0), press("b", "round1", 9000, 1)];
    const view = computeComposeResults(block, answers, { appStatus: "active", runtime: stepRuntime("round1", [], 1), viewer: { isHost: true, participantHash: null } }).views[0];
    expect(view.kind === "fastest" && view.order.map((o) => o.name)).toEqual(["B"]);
  });

  it("needs the steps flow (each buzz input is a round)", () => {
    const open = structuredClone(exampleBuzzer);
    (open.blocks[0] as { flow: string }).flow = "open";
    expect(AppSpecSchema.safeParse(open).success).toBe(false);
  });
});
