// Presets (choice poll, collect group order, open_text word cloud) expand into compose, and the old
// behaviours survive the move: vote-then-see results, hidden-until-close, server-side order totals
// with participants seeing only count + total, word limits, remix summaries, and old stored apps.
import { describe, expect, it } from "vitest";
import { exampleMilkTeaOrder, exampleOneWordCloud, exampleWorkshopVote } from "@/engine/app-spec/app-spec-examples";
import type { AppSpecDraft, ComposeBlock } from "@/engine/app-spec/app-spec-schema";
import type { AnswerRow, AppRuntime } from "@/engine/blocks/block-definition-types";
import { upgradeStoredSpec } from "@/engine/blocks/block-vocabulary";
import { composeBlock, type ComposePayload } from "@/engine/blocks/compose/compose-block";
import { orderLineTotal } from "@/engine/blocks/compose/compose-view-aggregators";
import { optionIdsFromLabels } from "@/engine/blocks/presets/preset-definition-types";
import { runtimeSpec } from "./runtime-spec-test-helper";

const runtime: AppRuntime = { openQuestionId: null, revealedQuestionIds: [] };
const composeOf = (draft: AppSpecDraft) => runtimeSpec(draft).blocks[0] as ComposeBlock;
const row = (hash: string, name: string, values: ComposePayload["values"], createdAt = 1): AnswerRow<ComposePayload> => ({
  blockId: "b",
  itemId: "",
  participantHash: hash,
  displayName: name,
  payload: { kind: "compose", values },
  createdAt,
});
const view = (appStatus: "active" | "closed", isHost: boolean, participantHash: string | null) => ({ appStatus, runtime, viewer: { isHost, participantHash } });
const check = (block: ComposeBlock, values: ComposePayload["values"]) => composeBlock.validate(block, { kind: "compose", values }, { itemId: "", runtime });

describe("choice preset → compose poll", () => {
  const poll = composeOf(exampleWorkshopVote);

  it("expands into one choice input + a bar chart shown after voting", () => {
    expect(poll).toMatchObject({ type: "compose", id: "topic", inputs: [{ id: "vote", kind: "choice", multi: false, required: true }], views: [{ kind: "bars", source: "vote", visibleTo: "after_submit" }] });
    expect(check(poll, { vote: "ux" })).toBeNull();
    expect(check(poll, { vote: ["ux", "data"] })).toBe("bad_payload");
    expect(check(poll, { vote: "nope" })).toBe("bad_payload");
  });

  it("shows the chart to the host always, to a participant only after they voted", () => {
    const rows = [row("a", "", { vote: "ux" }), row("b", "", { vote: "ux" }, 2), row("c", "", { vote: "du-lieu" }, 3)];
    expect(composeBlock.computeResults(poll, rows, view("active", true, null))!.views[0]).toMatchObject({ kind: "bars", total: 3 });
    expect(composeBlock.computeResults(poll, rows, view("active", false, "z"))!.views).toEqual([]);
    const mine = composeBlock.computeResults(poll, rows, view("active", false, "a"))!.views[0];
    if (mine.kind === "bars") expect(mine.bars.find((b) => b.id === "ux")?.value).toBe(2);
  });

  it("'hide results until closed' keeps a placeholder until the app closes", () => {
    const hidden = composeOf({ ...exampleWorkshopVote, blocks: [{ ...(exampleWorkshopVote.blocks[0] as object), showResults: "after_close" }] } as AppSpecDraft);
    const rows = [row("a", "", { vote: "ux" })];
    expect(composeBlock.computeResults(hidden, rows, view("active", false, "a"))!.views[0].kind).toBe("pending");
    expect(composeBlock.computeResults(hidden, rows, view("closed", false, "a"))!.views[0].kind).toBe("bars");
  });

  it("puts the winner first in the remix summary", () => {
    const rows = [row("a", "", { vote: "ux" }), row("b", "", { vote: "ux" }, 2), row("c", "", { vote: "ai-agent" }, 3)];
    const summary = composeBlock.summarizeForRemix(poll, composeBlock.computeResults(poll, rows, view("active", true, null)));
    expect(summary).toMatch(/^Bạn muốn nghe chủ đề nào nhất\?: UX 2, AI agent 1/);
  });
});

describe("collect preset → compose order form", () => {
  const order = composeOf(exampleMilkTeaOrder);
  const drink = order.inputs.find((i) => i.kind === "choice")!;
  const qty = order.inputs.find((i) => i.kind === "number")!;

  it("turns priced selects into priced choices with stable ids and adds an orders view on the quantity", () => {
    expect(drink.options?.every((o) => /^[a-z0-9-]+$/.test(o.id) && (o.price ?? 0) > 0)).toBe(true);
    expect(order.views).toEqual([expect.objectContaining({ kind: "orders", source: qty.id, visibleTo: "everyone" })]);
    expect(optionIdsFromLabels(["Trà sữa", "Trà  sữa", "!!"])).toEqual(["tra-sua", "tra-sua-2", "opt-3"]);
  });

  it("computes line totals on the server: Σ option prices × quantity (default 1)", () => {
    const [first] = drink.options!;
    expect(orderLineTotal(order.inputs, { [drink.id]: first.id, [qty.id]: 3 }, qty.id)).toEqual({ qty: 3, total: first.price! * 3 });
    expect(orderLineTotal(order.inputs, { [drink.id]: first.id }, qty.id).qty).toBe(1);
  });

  it("gives the host every order and participants only count + total", () => {
    const [a, b] = drink.options!;
    const rows = [row("p1", "An", { [drink.id]: a.id, [qty.id]: 2 }), row("p2", "Bình", { [drink.id]: b.id }, 2)];
    const expected = a.price! * 2 + b.price!;
    const host = composeBlock.computeResults(order, rows, view("active", true, null))!.views[0];
    expect(host).toMatchObject({ kind: "orders", count: 2, total: expected, priced: true });
    if (host.kind === "orders") expect(host.rows.map((r) => r.name)).toEqual(["An", "Bình"]);
    const guest = composeBlock.computeResults(order, rows, view("active", false, "p1"))!.views[0];
    expect(guest).toMatchObject({ kind: "orders", count: 2, total: expected, rows: [] });
  });

  it("drops prices when the form doesn't sum money", () => {
    const counted = composeOf({ ...exampleMilkTeaOrder, blocks: [{ ...(exampleMilkTeaOrder.blocks[0] as object), aggregate: "count" }] } as AppSpecDraft);
    expect(counted.inputs.flatMap((i) => i.options ?? []).every((o) => o.price === null)).toBe(true);
  });
});

describe("open_text preset → compose word cloud", () => {
  const cloud = composeOf(exampleOneWordCloud);

  it("keeps the word limit and the after-answer cloud", () => {
    expect(cloud.inputs[0]).toMatchObject({ kind: "text", max: 1 });
    expect(check(cloud, { answer: "Vui" })).toBeNull();
    expect(check(cloud, { answer: "Rất vui" })).toBe("bad_payload");
    expect(check(cloud, { answer: "xem www.x.com" })).toBe("bad_payload");
    const res = composeBlock.computeResults(cloud, [row("a", "", { answer: "Vui" }), row("b", "", { answer: "vui " }, 2)], view("active", false, "a"))!;
    expect(res.views[0]).toMatchObject({ kind: "cloud", words: [{ text: "Vui", count: 2 }] });
  });
});

describe("stored specs on read", () => {
  it("expand presets; runtime specs come back equal", () => {
    const upgraded = upgradeStoredSpec(structuredClone(exampleWorkshopVote));
    expect(upgraded.blocks[0]).toEqual(composeOf(exampleWorkshopVote));
    const current = runtimeSpec(exampleWorkshopVote);
    expect(upgradeStoredSpec(structuredClone(current))).toEqual(current);
  });

  it("fill defaults added since the app was saved, keep blocks that fail newer rules, drop unknown types", () => {
    const current = runtimeSpec(exampleWorkshopVote);
    const block = composeOf(exampleWorkshopVote);
    // saved before `query` existed on views
    const old = { ...current, blocks: [{ ...block, views: block.views.map(({ query: _q, ...v }) => v) }] };
    expect(upgradeStoredSpec(old).blocks[0]).toEqual(block);
    const stricter = { ...block, views: [{ ...block.views[0], visibleTo: "after_step" as const }] };
    const out = upgradeStoredSpec({ ...current, blocks: [{ type: "hologram", id: "h" }, stricter, "junk"] });
    expect(out.blocks).toEqual([stricter]);
  });
});
