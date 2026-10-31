// Compose features beyond one-record forms: many entries per person, host-paced steps with timers,
// people picker + random teams (roster), date inputs, and conditional inputs.
import { describe, expect, it } from "vitest";
import { AppSpecSchema, type AppSpecDraft, type ComposeBlock } from "@/engine/app-spec/app-spec-schema";
import type { AnswerRow, AppRuntime } from "@/engine/blocks/block-definition-types";
import { composeBlock, ComposeBlockSchema, type ComposePayload } from "@/engine/blocks/compose/compose-block";
import { rosterIdOf } from "@/engine/blocks/compose/compose-atoms-schema";

const empty: AppRuntime = { openQuestionId: null, revealedQuestionIds: [] };
const hashOf = (n: string) => n.repeat(64).slice(0, 64); // fake hex participant hashes: "aaaa…", "bbbb…"
const row = (who: string, name: string, itemId: string, payload: Omit<ComposePayload, "kind">, createdAt: number): AnswerRow<ComposePayload> => ({
  blockId: "b",
  itemId,
  participantHash: hashOf(who),
  displayName: name,
  payload: { kind: "compose", ...payload },
  createdAt,
});
const view = (runtime: AppRuntime, isHost: boolean, who: string | null = null, appStatus: "active" | "closed" = "active") => ({
  appStatus,
  runtime,
  viewer: { isHost, participantHash: who ? hashOf(who) : null },
});
const input = (over: Record<string, unknown>) => ({ required: false, options: null, multi: null, capacity: null, min: null, max: null, unit: null, ...over });
const viewOf = (over: Record<string, unknown>) => ({ title: null, source: null, op: null, topN: null, visibleTo: "everyone", ...over });
const block = (over: Record<string, unknown>): ComposeBlock => ComposeBlockSchema.parse({ type: "compose", id: "b", title: "Test", note: null, inputs: [], views: [], ...over });
const check = (b: ComposeBlock, itemId: string, payload: Omit<ComposePayload, "kind">, runtime = empty) => composeBlock.validate(b, { kind: "compose", ...payload }, { itemId, runtime });
const act = (b: ComposeBlock, name: string, runtime: AppRuntime, answers: AnswerRow<ComposePayload>[] = [], random = () => 0.5) => {
  const res = composeBlock.hostActions![name](b, runtime, { args: {}, random, answers });
  if (!res.ok) throw new Error(res.error);
  return res.runtime;
};

describe("many entries per person (expense log)", () => {
  const log = block({
    entries: "many",
    inputs: [input({ id: "amount", kind: "number", label: "Số tiền", required: true, min: 0, unit: "đ" }), input({ id: "for", kind: "text", label: "Cho việc gì" })],
    views: [viewOf({ id: "settle", kind: "split", source: "amount" }), viewOf({ id: "top", kind: "leaderboard", source: "amount" })],
  });

  it("accepts entry ids, deletions, and rejects the one-record id", () => {
    expect(check(log, "e-abc123", { values: { amount: 100 } })).toBeNull();
    expect(check(log, "e-abc123", { values: {}, removed: true })).toBeNull();
    expect(check(log, "", { values: { amount: 100 } })).toBe("bad_payload");
    expect(check(log, "e-abc123", { values: { amount: 1 }, removed: true })).toBe("bad_payload");
  });

  it("adds each person's entries up for the split and the leaderboard, ignoring deleted ones", () => {
    const rows = [
      row("a", "An", "e-000001", { values: { amount: 200 } }, 1),
      row("a", "An", "e-000002", { values: { amount: 100 } }, 2),
      row("b", "Bình", "e-000003", { values: { amount: 0 } }, 3),
      row("b", "Bình", "e-000004", { values: {}, removed: true }, 4),
    ];
    const res = composeBlock.computeResults(log, rows, view(empty, true))!;
    expect(res.submissions).toBe(3);
    expect(res.views[0]).toMatchObject({ kind: "split", total: 300, share: 150, transfers: [{ from: "Bình", to: "An", amount: 150 }] });
    expect(res.views[1]).toMatchObject({ kind: "leaderboard", rows: [{ name: "An", value: 300 }, { name: "Bình", value: 0 }] });
  });
});

describe("host-paced steps with a timer", () => {
  const steps = block({
    flow: "steps",
    inputs: [
      input({ id: "q1", kind: "choice", label: "Câu 1", required: true, timeLimitSec: 20, options: [{ id: "x", label: "X", price: null }, { id: "y", label: "Y", price: null }] }),
      input({ id: "q2", kind: "rating", label: "Câu 2", required: true }),
    ],
    views: [viewOf({ id: "r1", kind: "bars", source: "q1", visibleTo: "after_step" })],
  });

  it("only accepts the open step, and not after its time is up", () => {
    expect(check(steps, "q1", { values: { q1: "x" } })).toBe("question_closed");
    const open = act(steps, "next", empty);
    expect(check(steps, "q1", { values: { q1: "x" } }, open)).toBeNull();
    expect(check(steps, "q2", { values: { q2: 4 } }, open)).toBe("question_closed");
    const late = { ...open, blocks: { b: { ...(open.blocks!.b as object), step: { current: "q1", openedAt: Date.now() - 30_000, done: [] } } } };
    expect(check(steps, "q1", { values: { q1: "x" } }, late)).toBe("question_closed");
  });

  it("reveals a step's results to participants once the host moves on, and merges steps per person", () => {
    const s1 = act(steps, "next", empty);
    const rows = [row("a", "An", "q1", { values: { q1: "x" } }, 1)];
    expect(composeBlock.computeResults(steps, rows, view(s1, false, "a"))!.views[0].kind).toBe("pending");
    const s2 = act(steps, "next", s1);
    const res = composeBlock.computeResults(steps, [...rows, row("a", "An", "q2", { values: { q2: 5 } }, 2)], view(s2, false, "a"))!;
    expect(res.views[0]).toMatchObject({ kind: "bars", total: 1 });
    expect(res.step).toMatchObject({ current: "q2", done: ["q1"] });
    expect(composeBlock.computeResults(steps, [...rows, row("a", "An", "q2", { values: { q2: 5 } }, 2)], view(s2, true))!.submissions).toBe(1);
    expect(() => act(steps, "next", act(steps, "next", s2))).toThrow();
  });
});

describe("people picker and random teams", () => {
  const leader = block({ inputs: [input({ id: "who", kind: "person", label: "Bầu ai?", required: true })], views: [viewOf({ id: "votes", kind: "bars", source: "who" })] });
  const teams = block({ inputs: [], views: [viewOf({ id: "t", kind: "teams", teams: 2 })] });

  it("forces names, accepts check-ins only where a roster is needed, and votes by roster id", () => {
    const draft: AppSpecDraft = { specVersion: 1, locale: "vi", title: "Bầu trưởng nhóm", description: null, theme: "ink", requireName: false, blocks: [leader] };
    expect(AppSpecSchema.parse(draft).requireName).toBe(true);
    expect(check(leader, "_join", { values: {}, join: true })).toBeNull();
    expect(check(block({ inputs: [input({ id: "t", kind: "text", label: "T" })] }), "_join", { values: {}, join: true })).toBe("bad_payload");
    expect(check(leader, "", { values: { who: rosterIdOf(hashOf("b")) } })).toBeNull();
    expect(check(leader, "", { values: { who: "not-an-id" } })).toBe("bad_payload");
    const rows = [row("a", "An", "_join", { values: {}, join: true }, 1), row("b", "Bình", "", { values: { who: rosterIdOf(hashOf("a")) } }, 2)];
    const res = composeBlock.computeResults(leader, rows, view(empty, false, "b"))!;
    expect(res.roster?.map((r) => r.name)).toEqual(["An", "Bình"]);
    expect(res.views[0]).toMatchObject({ kind: "bars", bars: [{ label: "An", value: 1 }, { label: "Bình", value: 0 }] });
  });

  it("deals everyone who joined into teams with server randomness; late joiners wait", () => {
    const joins = ["a", "b", "c", "d"].map((w, i) => row(w, w.toUpperCase(), "_join", { values: {}, join: true }, i));
    const drawn = act(teams, "shuffle", empty, joins, () => 0);
    const res = composeBlock.computeResults(teams, [...joins, row("e", "E", "_join", { values: {}, join: true }, 9)], view(drawn, false, "a"))!;
    const t = res.views[0];
    expect(t.kind === "teams" && t.teams?.map((x) => x.members.length)).toEqual([2, 2]);
    expect(t.kind === "teams" && t.waiting).toEqual(["E"]);
    expect(() => act(teams, "shuffle", empty, joins.slice(0, 1))).toThrow();
  });
});

describe("date inputs", () => {
  const meet = block({ inputs: [input({ id: "d", kind: "date", label: "Ngày", required: true })], views: [viewOf({ id: "g", kind: "bars", source: "d" })] });

  it("validates real calendar dates and counts answers per date", () => {
    expect(check(meet, "", { values: { d: "2026-10-02" } })).toBeNull();
    expect(check(meet, "", { values: { d: "2026-02-30" } })).toBe("bad_payload");
    expect(check(meet, "", { values: { d: "02/10/2026" } })).toBe("bad_payload");
    const rows = [row("a", "", "", { values: { d: "2026-10-02" } }, 1), row("b", "", "", { values: { d: "2026-10-02" } }, 2), row("c", "", "", { values: { d: "2026-10-01" } }, 3)];
    expect(composeBlock.computeResults(meet, rows, view(empty, true))!.views[0]).toMatchObject({ bars: [{ label: "01/10/2026", value: 1 }, { label: "02/10/2026", value: 2 }] });
  });
});

describe("conditional inputs (showIf)", () => {
  const options = [{ id: "yes", label: "Có", price: null }, { id: "no", label: "Không", price: null }];
  const form = block({
    inputs: [input({ id: "go", kind: "choice", label: "Đi không?", required: true, options }), input({ id: "why", kind: "text", label: "Vì sao?", required: true, showIf: { input: "go", equals: "no" } })],
  });

  it("requires a shown input and rejects a value for a hidden one", () => {
    expect(check(form, "", { values: { go: "yes" } })).toBeNull();
    expect(check(form, "", { values: { go: "yes", why: "bận" } })).toBe("bad_payload");
    expect(check(form, "", { values: { go: "no" } })).toBe("bad_payload");
    expect(check(form, "", { values: { go: "no", why: "bận" } })).toBeNull();
  });

  it("only points at an earlier choice and one of its options", () => {
    const bad = (showIf: object) => ComposeBlockSchema.safeParse({ ...form, inputs: [form.inputs[0], { ...form.inputs[1], showIf }] }).success;
    expect(bad({ input: "go", equals: "maybe" })).toBe(false);
    expect(bad({ input: "why", equals: "no" })).toBe(false);
  });
});

