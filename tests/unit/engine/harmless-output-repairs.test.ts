// Slips with one sensible meaning are fixed before validation (each one seen in the generation eval).
import { describe, expect, it } from "vitest";
import { repairHarmlessSlips } from "@/engine/generation/harmless-output-repairs";

const out = (spec: Record<string, unknown>) => ({ outcome: "ok", spec: { specVersion: 1, locale: "vi", title: "T", description: null, theme: "ink", requireName: false, blocks: [], ...spec }, suggestion: null, riskFlags: ["none"] });
const blocks = (r: unknown) => (r as { spec: { blocks: Array<Record<string, unknown>> } }).spec.blocks;

describe("repairHarmlessSlips", () => {
  it("names a block's brick from its fields and gives it an id", () => {
    const r = repairHarmlessSlips(out({ blocks: [{ title: "Bấm chuông", flow: "steps", inputs: [] }, { questions: [] }, { source: "participants", removeWinner: true }] }));
    expect(blocks(r).map((b) => [b.type, b.id])).toEqual([
      ["compose", "block1"],
      ["quiz", "block2"],
      ["wheel", "block3"],
    ]);
  });

  it("keeps a block's own type and id, and leaves an unrecognizable block for validation", () => {
    const r = repairHarmlessSlips(out({ blocks: [{ type: "choice", id: "vote" }, { foo: 1 }] }));
    expect(blocks(r)[0]).toMatchObject({ type: "choice", id: "vote" });
    expect(blocks(r)[1].type).toBeUndefined();
  });

  it("fills a quiz question's missing points / time with the documented defaults", () => {
    const r = repairHarmlessSlips(out({ blocks: [{ type: "quiz", id: "q", questions: [{ id: "q1", points: null, timeLimitSec: null }, { id: "q2", points: 50, timeLimitSec: 15 }] }] }));
    expect(blocks(r)[0].questions).toEqual([
      { id: "q1", points: 100, timeLimitSec: 20 },
      { id: "q2", points: 50, timeLimitSec: 15 },
    ]);
  });

  it("swaps an invented theme for the default", () => {
    expect((repairHarmlessSlips(out({ theme: "neon" })) as { spec: { theme: string } }).spec.theme).toBe("ink");
  });
  it("drops a text limit written in characters and keeps a valid word limit", () => {
    const r = repairHarmlessSlips(out({ blocks: [{ type: "compose", inputs: [{ kind: "text", max: 500 }, { kind: "text", max: 20 }, { kind: "number", max: 500 }] }] }));
    expect((blocks(r)[0].inputs as Array<{ max: number | null }>).map((i) => i.max)).toEqual([null, 20, 500]);
  });
  it("moves a results-only compose block into the block before it", () => {
    const form = { type: "compose", id: "form", inputs: [{ kind: "rating" }], views: [{ kind: "bars" }] };
    const r = repairHarmlessSlips(out({ blocks: [form, { type: "compose", id: "results", inputs: [], views: [{ kind: "stat" }] }] }));
    expect(blocks(r)).toHaveLength(1);
    expect((blocks(r)[0].views as Array<{ kind: string }>).map((v) => v.kind)).toEqual(["bars", "stat"]);
  });
  it("keeps a teams block, which is valid without inputs", () => {
    const r = repairHarmlessSlips(out({ blocks: [{ type: "compose", id: "a", inputs: [{ kind: "text" }], views: [] }, { type: "compose", id: "b", inputs: [], views: [{ kind: "teams" }] }] }));
    expect(blocks(r)).toHaveLength(2);
  });
  it("treats missing risk flags as none (the phishing scan runs anyway)", () => {
    const { riskFlags: _drop, ...noFlags } = out({});
    expect((repairHarmlessSlips(noFlags) as { riskFlags: string[] }).riskFlags).toEqual(["none"]);
  });
});
