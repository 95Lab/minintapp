// compose brick: wiring validation, per-atom answer validation, the fixed aggregators (split,
// slots + waitlist, bars/stat), server-side visibility, the flat AI format, and the keyword mock.
import { describe, expect, it } from "vitest";
import { AppSpecSchema, type ComposeBlock } from "@/engine/app-spec/app-spec-schema";
import { exampleSessionRating, exampleSignupSlots, exampleTripSplit } from "@/engine/app-spec/app-spec-examples-compose";
import type { AnswerRow, AppRuntime } from "@/engine/blocks/block-definition-types";
import { composeBlock, ComposeBlockSchema, type ComposePayload } from "@/engine/blocks/compose/compose-block";
import { settleTransfers } from "@/engine/blocks/compose/compose-view-aggregators";
import { appSpecToFlatSpec, flatSpecToAppSpec } from "@/engine/generation/llm-flat-spec-conversion";

const runtime: AppRuntime = { openQuestionId: null, revealedQuestionIds: [] };
const host = { appStatus: "active" as const, runtime, viewer: { isHost: true, participantHash: null } };
const asParticipant = (hash: string, appStatus: "active" | "closed" = "active") => ({ appStatus, runtime, viewer: { isHost: false, participantHash: hash } });
const blockOf = (spec: { blocks: unknown[] }) => spec.blocks[0] as ComposeBlock;
const row = (hash: string, name: string, values: ComposePayload["values"], createdAt: number): AnswerRow<ComposePayload> => ({
  blockId: "b",
  itemId: "",
  participantHash: hash,
  displayName: name,
  payload: { kind: "compose", values },
  createdAt,
});
const check = (block: ComposeBlock, values: ComposePayload["values"]) => composeBlock.validate(block, { kind: "compose", values }, { itemId: "", runtime });

describe("compose wiring", () => {
  it.each([exampleTripSplit, exampleSignupSlots, exampleSessionRating])("accepts $title and round-trips the flat AI format", (spec) => {
    // Parsing fills defaults (entries, flow, showIf…); the flat AI format must round-trip to the same runtime spec.
    const stored = AppSpecSchema.parse(spec);
    expect(stored.blocks[0].type).toBe("compose");
    expect(AppSpecSchema.parse(flatSpecToAppSpec(appSpecToFlatSpec(spec)))).toEqual(AppSpecSchema.parse(spec));
  });

  it("rejects views wired to missing or incompatible inputs", () => {
    const base = structuredClone(blockOf(exampleSessionRating));
    const cloudOverNumber = { ...base, views: [{ ...base.views[0], kind: "cloud" as const, source: "stars" }] };
    const unknown = { ...base, views: [{ ...base.views[0], source: "nope" }] };
    const sumWithoutSource = { ...base, views: [{ ...base.views[0], source: null, op: "sum" as const }] };
    const slotWithoutOptions = { ...base, inputs: [{ ...base.inputs[0], kind: "slot" as const, options: null }], views: [] };
    for (const bad of [cloudOverNumber, unknown, sumWithoutSource, slotWithoutOptions]) expect(ComposeBlockSchema.safeParse(bad).success).toBe(false);
    expect(ComposeBlockSchema.safeParse({ ...base, views: [{ ...base.views[0], source: null, op: "count" as const }] }).success).toBe(true);
  });

  it("nulls fields the model filled for the wrong atom kind instead of failing", () => {
    const flat = appSpecToFlatSpec(structuredClone(exampleSessionRating));
    const inputs = (flat.blocks[0] as unknown as { inputs: Array<Record<string, unknown>> }).inputs;
    inputs[1].options = [];
    inputs[1].capacity = 3;
    expect(AppSpecSchema.parse(flatSpecToAppSpec(flat))).toEqual(AppSpecSchema.parse(exampleSessionRating));
  });
});

describe("compose answers", () => {
  it("validates each atom and rejects unknown fields, links and missing required values", () => {
    const split = blockOf(exampleTripSplit);
    const rating = blockOf(exampleSessionRating);
    const slots = blockOf(exampleSignupSlots);
    expect(check(split, { paid: 250000, for: "Xăng xe" })).toBeNull();
    expect(check(split, { for: "Xăng" })).toBe("bad_payload");
    expect(check(split, { paid: -1 })).toBe("bad_payload");
    expect(check(split, { paid: 1, extra: "x" })).toBe("bad_payload");
    expect(check(split, { paid: 1, for: "xem www.evil.com" })).toBe("bad_payload");
    expect(check(rating, { stars: 6 })).toBe("bad_payload");
    expect(check(rating, { stars: 4.5 })).toBe("bad_payload");
    expect(check(rating, { stars: 5 })).toBeNull();
    expect(check(slots, { item: "nuoc" })).toBeNull();
    expect(check(slots, { item: "bia" })).toBe("bad_payload");
  });
});

describe("compose views", () => {
  it("split: equal shares and who pays whom", () => {
    const rows = [row("a", "An", { paid: 300 }, 1), row("b", "Bình", { paid: 0 }, 2), row("c", "Chi", { paid: 0 }, 3)];
    const view = composeBlock.computeResults(blockOf(exampleTripSplit), rows, host)!.views.find((v) => v.kind === "split");
    expect(view).toMatchObject({ total: 300, share: 100 });
    if (view?.kind === "split") expect(view.transfers).toEqual([
      { from: "Bình", to: "An", amount: 100 },
      { from: "Chi", to: "An", amount: 100 },
    ]);
    expect(settleTransfers([{ name: "x", balance: 0 }])).toEqual([]);
  });

  it("split: the total is the sum of the rounded per-person amounts, so sub-cent payments still balance", () => {
    const rows = [row("a", "An", { paid: 0.005 }, 1), row("b", "Bình", { paid: 0.005 }, 2), row("c", "Chi", { paid: 0.001 }, 3)];
    const view = composeBlock.computeResults(blockOf(exampleTripSplit), rows, host)!.views.find((v) => v.kind === "split");
    expect(view).toMatchObject({ total: 0.02, share: 0.01 });
    if (view?.kind === "split") expect(view.people.map((p) => p.balance)).toEqual([0, 0, -0.01]);
  });

  it("slots: first come first served, later sign-ups wait, the viewer learns they wait", () => {
    const rows = [row("a", "An", { item: "nuoc" }, 1), row("b", "Bình", { item: "nuoc" }, 2), row("c", "Chi", { item: "nuoc" }, 3)];
    const res = composeBlock.computeResults(blockOf(exampleSignupSlots), rows, asParticipant("c"))!;
    expect(res.seats.item).toEqual({ nuoc: 2 });
    expect(res.myWaitlist).toEqual(["item"]);
    const groups = res.views.find((v) => v.kind === "groups");
    if (groups?.kind === "groups") expect(groups.groups.find((g) => g.id === "nuoc")).toMatchObject({ names: ["An", "Bình"], waitlist: ["Chi"] });
  });

  it("rating: bars per star and average; host-only views never reach participants", () => {
    const rows = [row("a", "", { stars: 5 }, 1), row("b", "", { stars: 3, comment: "Nói chậm hơn" }, 2)];
    const forHost = composeBlock.computeResults(blockOf(exampleSessionRating), rows, host)!;
    expect(forHost.views.find((v) => v.kind === "stat")).toMatchObject({ value: 4, op: "avg" });
    const bars = forHost.views.find((v) => v.kind === "bars");
    if (bars?.kind === "bars") expect(bars.bars.map((b) => b.value)).toEqual([0, 0, 1, 0, 1]);
    expect(forHost.views.map((v) => v.id)).toContain("ideas");
    expect(composeBlock.computeResults(blockOf(exampleSessionRating), rows, asParticipant("a"))!.views.map((v) => v.id)).toEqual(["avg", "dist"]);
  });

  it("after_close views are placeholders until the app closes; a block without views gives the host a table", () => {
    const block = structuredClone(blockOf(exampleSessionRating));
    block.views = [{ ...block.views[0], visibleTo: "after_close" }];
    expect(composeBlock.computeResults(block, [], asParticipant("a"))!.views[0].kind).toBe("pending");
    expect(composeBlock.computeResults(block, [], asParticipant("a", "closed"))!.views[0].kind).toBe("stat");
    block.views = [];
    expect(composeBlock.computeResults(block, [row("a", "An", { stars: 4 }, 1)], host)!.views[0]).toMatchObject({ kind: "table", rows: [["An", "4★", ""]] });
  });
});

