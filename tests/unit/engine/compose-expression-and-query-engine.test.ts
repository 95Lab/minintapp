// Expression language (JSON tree, tree-walk evaluator, save-time issues) and the query engine
// (where → groupBy → measures → derived → sort/limit) behind every numeric compose view.
import { describe, expect, it } from "vitest";
import { AppSpecSchema, type AppSpecDraft, type ComposeBlock } from "@/engine/app-spec/app-spec-schema";
import { computeComposeResults } from "@/engine/blocks/compose/compose-results";
import { stripPrivateFields } from "@/engine/app-spec/strip-private-fields";
import { appSpecToFlatSpec, flatSpecToAppSpec } from "@/engine/generation/llm-flat-spec-conversion";
import type { WireQuery } from "@/engine/blocks/compose/compose-llm-query-wire";
import { scanAppSpec } from "@/engine/security/security-interfaces";
import type { ComposeRow } from "@/engine/blocks/compose/compose-aggregation-helpers";
import type { ComposeInput } from "@/engine/blocks/compose/compose-atoms-schema";
import { queryIssues, QuerySchema, runQuery, type QueryDraft } from "@/engine/blocks/compose/compose-query-engine";
import { evalExpr, evalFilter } from "@/engine/blocks/compose/expression/expr-eval";
import { exprIssues } from "@/engine/blocks/compose/expression/expr-issues";
import { E, ExprSchema, MAX_EXPR_DEPTH, type Expr } from "@/engine/blocks/compose/expression/expr-types";

const noOpts = { options: null, multi: null, capacity: null, min: null, max: null, unit: null, showIf: null, timeLimitSec: null };
const inputs: ComposeInput[] = [
  { id: "amount", kind: "number", label: "Số tiền", required: true, ...noOpts, unit: "đ" },
  { id: "cat", kind: "choice", label: "Loại", required: false, ...noOpts, options: [{ id: "food", label: "Ăn", price: 30000 }, { id: "fuel", label: "Xăng", price: null }] },
  { id: "tags", kind: "choice", label: "Nhãn", required: false, ...noOpts, multi: true, options: [{ id: "a", label: "A", price: 5 }, { id: "b", label: "B", price: 7 }] },
];
const ctx = (row: Record<string, unknown>) => ({ row: row as never, inputs });
const row = (who: string, values: ComposeRow["values"], n = 0): ComposeRow => ({ key: `${who}:${n}`, participantHash: who, name: who.toUpperCase(), values });
const rows: ComposeRow[] = [
  row("lan", { amount: 100, cat: "food" }),
  row("minh", { amount: 300, cat: "fuel" }),
  row("lan", { amount: 50, cat: "fuel" }, 1),
  row("ha", { cat: "food" }),
];
const run = (q: QueryDraft) => runQuery(QuerySchema.parse(q), rows, inputs);

describe("expressions", () => {
  it("does arithmetic with SQL-like nulls and never produces Infinity", () => {
    expect(evalExpr(E.add(E.field("amount"), E.lit(5)), ctx({ amount: 10 }))).toBe(15);
    expect(evalExpr(E.add(E.field("amount"), E.lit(5)), ctx({}))).toBeNull();
    expect(evalExpr(E.div(E.lit(1), E.lit(0)), ctx({}))).toBeNull();
    expect(evalExpr(E.mul(E.lit("3"), E.lit(2)), ctx({}))).toBeNull();
  });

  it("branches on filters and calls registered functions only", () => {
    const tier: Expr = { op: "if", cond: E.cmp(E.field("amount"), "gte", E.lit(200)), then: E.lit("big"), else: E.lit("small") };
    expect(evalExpr(tier, ctx({ amount: 300 }))).toBe("big");
    expect(evalExpr(tier, ctx({ amount: 20 }))).toBe("small");
    expect(evalExpr(E.call("round", E.lit(2.345), E.lit(2)), ctx({}))).toBe(2.35);
    expect(evalExpr(E.call("coalesce", E.field("x"), E.lit(7)), ctx({}))).toBe(7);
    expect(evalExpr(E.call("optionPrices"), ctx({ cat: "food", tags: ["a", "b"] }))).toBe(30012);
    expect(evalExpr(E.call("eval", E.lit("process.exit()")), ctx({}))).toBeNull();
    expect(evalExpr(E.call("constructor"), ctx({}))).toBeNull();
  });

  it("compares lists, empties and ISO dates", () => {
    expect(evalFilter(E.cmp(E.field("tags"), "has", E.lit("b")), ctx({ tags: ["a", "b"] }))).toBe(true);
    expect(evalFilter(E.cmp(E.field("tags"), "empty"), ctx({ tags: [] }))).toBe(true);
    expect(evalFilter(E.cmp(E.field("d"), "lt", E.lit("2026-10-02")), ctx({ d: "2026-10-01" }))).toBe(true);
    expect(evalFilter(E.cmp(E.field("amount"), "gt", E.lit("5")), ctx({ amount: 10 }))).toBe(false);
    expect(evalFilter({ op: "not", arg: { op: "or", args: [E.cmp(E.field("x"), "notEmpty")] } }, ctx({}))).toBe(true);
  });

  it("rejects garbage with a readable reason instead of crashing", () => {
    const scope = new Set(["amount"]);
    expect(ExprSchema.safeParse({ op: "js", code: "1+1" }).success).toBe(false);
    expect(ExprSchema.safeParse({ op: "div", args: [{ op: "lit", v: 1 }] }).success).toBe(false);
    expect(exprIssues(E.field("price"), scope)).toEqual(['unknown field "price" (available: amount)']);
    expect(exprIssues(E.call("fetch", E.lit("x")), scope)).toEqual(['unknown function "fetch"']);
    expect(exprIssues(E.call("round"), scope)).toEqual(['function "round" takes 1–2 argument(s), got 0']);
    let deep: Expr = E.field("amount");
    for (let i = 0; i < MAX_EXPR_DEPTH; i++) deep = E.add(deep, E.lit(1));
    expect(exprIssues(deep, scope)[0]).toMatch(/nested deeper/);
  });
});

describe("query engine", () => {
  it("aggregates every kept row into grand totals when nothing is grouped", () => {
    const r = run({ measures: [{ key: "n", fn: "count" }, { key: "sum", fn: "sum", expr: E.field("amount") }, { key: "avg", fn: "avg", expr: E.field("amount") }, { key: "filled", fn: "count", expr: E.field("amount") }] });
    expect(r.totals).toMatchObject({ n: 4, sum: 450, avg: 150, filled: 3, $groups: 1 });
    expect(r.groups).toEqual([{ key: "", name: null, values: { n: 4, sum: 450, avg: 150, filled: 3 } }]);
  });

  it("groups per participant in first-answer order; derived columns see totals and the group count", () => {
    const r = run({
      where: E.cmp(E.field("amount"), "notEmpty"),
      groupBy: "$participant",
      measures: [{ key: "paid", fn: "sum", expr: E.field("amount") }],
      derived: [{ key: "balance", expr: E.sub(E.field("paid"), E.div(E.field("$total.paid"), E.field("$groups"))) }],
    });
    expect(r.groups.map((g) => [g.name, g.values.paid, g.values.balance])).toEqual([["LAN", 150, -75], ["MINH", 300, 75]]);
    expect(r.totals.paid).toBe(450);
  });

  it("groups by a choice input, sorts (empties last) and limits", () => {
    const r = run({ groupBy: "cat", measures: [{ key: "spent", fn: "sum", expr: E.field("amount") }], sort: { key: "spent", dir: "desc" }, limit: 5 });
    expect(r.groups.map((g) => [g.key, g.values.spent])).toEqual([["fuel", 350], ["food", 100]]);
    expect(run({ groupBy: "$participant", measures: [{ key: "x", fn: "max", expr: E.field("amount") }], sort: { key: "x", dir: "asc" }, limit: 2 }).groups.map((g) => g.name)).toEqual(["LAN", "MINH"]);
  });

  it("validates names, grouping and sort keys at save time", () => {
    const issues = (q: QueryDraft) => queryIssues(QuerySchema.parse(q), inputs);
    expect(issues({ groupBy: "cat", measures: [{ key: "s", fn: "sum", expr: E.field("amount") }], derived: [{ key: "pct", expr: E.div(E.field("s"), E.field("$total.s")) }], sort: { key: "pct", dir: "desc" } })).toEqual([]);
    expect(issues({ groupBy: "amount", measures: [{ key: "s", fn: "count" }] })).toEqual(["groupBy: cannot group by a number input"]);
    expect(issues({ measures: [{ key: "s", fn: "sum", expr: E.field("nope") }], sort: { key: "zzz", dir: "asc" } })).toEqual([
      'measure s: "nope" is not an input of this block — add a number input with id "nope" to inputs, or use one of: amount, cat, tags',
      'sort: unknown column "zzz"',
    ]);
    // derived columns can't read raw inputs (they work on aggregates) or later columns
    expect(issues({ measures: [{ key: "s", fn: "count" }], derived: [{ key: "a", expr: E.field("b") }, { key: "b", expr: E.field("amount") }] })).toHaveLength(2);
    expect(QuerySchema.safeParse({ measures: [] }).success).toBe(false);
  });
});

describe("summary view (a calculation written as JSON in the spec)", () => {
  // Spending per category with each category's share of the total — no engine code knows this app.
  const byCategory = {
    id: "per-cat",
    kind: "summary" as const,
    title: "Chi theo loại",
    source: null,
    op: null,
    topN: null,
    visibleTo: "everyone" as const,
    query: {
      groupBy: "cat",
      measures: [
        { key: "spent", label: "Đã chi", fn: "sum" as const, expr: E.field("amount") },
        { key: "n", label: "Số khoản", fn: "count" as const },
      ],
      derived: [{ key: "pct", label: "% tổng", expr: E.call("round", E.mul(E.div(E.field("spent"), E.field("$total.spent")), E.lit(100)), E.lit(1)) }],
      sort: { key: "spent", dir: "desc" as const },
    },
  };
  const draft = (views: unknown[]): AppSpecDraft =>
    ({
      specVersion: 1,
      locale: "vi",
      title: "Sổ chi",
      description: "Ghi khoản chi",
      theme: "forest",
      requireName: true,
      blocks: [{ type: "compose", id: "b", title: "Khoản chi", note: null, entries: "many", inputs, views }],
    }) as AppSpecDraft;

  it("computes grouped rows and one-row totals from the spec alone", () => {
    const total = { ...byCategory, id: "all", title: "Tổng", query: { measures: [{ key: "s", label: "Tổng chi", fn: "sum", expr: E.field("amount") }] } };
    const block = AppSpecSchema.parse(draft([byCategory, total])).blocks[0] as ComposeBlock;
    const answers = rows.map((r, i) => ({ blockId: "b", itemId: `e-${i}abcdef`, participantHash: r.participantHash, displayName: r.name, payload: { kind: "compose" as const, values: r.values }, createdAt: i }));
    const views = computeComposeResults(block, answers, { appStatus: "active", runtime: { openQuestionId: null, revealedQuestionIds: [] }, viewer: { isHost: true, participantHash: null } }).views;
    expect(views[0]).toMatchObject({ kind: "table", keyColumn: "Loại", columns: ["Đã chi", "Số khoản", "% tổng"], rows: [["Xăng", 350, 2, 77.8], ["Ăn", 100, 2, 22.2]] });
    expect(views[1]).toMatchObject({ kind: "table", keyColumn: null, columns: ["Tổng chi"], rows: [[450]] });
  });

  it("bounds size and depth before parsing, so a hostile query fails validation instead of crashing", () => {
    let deep: unknown = { op: "lit", v: 1 };
    for (let i = 0; i < 5000; i++) deep = { op: "add", args: [deep, { op: "lit", v: 1 }] };
    expect(QuerySchema.safeParse({ measures: [{ key: "s", fn: "sum", expr: deep }] }).success).toBe(false);
    const wide = { op: "or", args: Array.from({ length: 8 }, () => ({ op: "or", args: Array.from({ length: 8 }, () => E.cmp(E.field("amount"), "notEmpty")) })) };
    const parsed = QuerySchema.safeParse({ where: wide, measures: [{ key: "n", fn: "count" }] });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].message).toMatch(/too large/);
  });

  it("scans string literals a summary can print", () => {
    const shout = { ...byCategory, query: { ...byCategory.query, derived: [{ key: "msg", expr: E.lit("Nhập mật khẩu ngân hàng để nhận quà") }] } };
    expect(scanAppSpec(AppSpecSchema.parse(draft([shout])), ["none"]).ok).toBe(false);
  });

  it("rejects a broken query at save time with the reason", () => {
    const broken = { ...byCategory, query: { ...byCategory.query, derived: [{ key: "pct", expr: E.field("$total.nope") }] } };
    const parsed = AppSpecSchema.safeParse(draft([broken]));
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues.map((i) => i.message).join("\n")).toContain('unknown field "$total.nope"');
    expect(AppSpecSchema.safeParse(draft([{ ...byCategory, kind: "bars", source: "cat" }])).success).toBe(false);
  });

  it("round-trips the AI format; a query beyond the AI subset is left out of what the model sees", () => {
    const spec = AppSpecSchema.parse(draft([byCategory]));
    const views = (s: typeof spec) => (s.blocks[0] as ComposeBlock).views;
    expect(views(AppSpecSchema.parse(flatSpecToAppSpec(appSpecToFlatSpec(spec))))).toEqual(views(spec));
    // conditions and scoring are in the AI subset now: they round-trip too
    const scored = {
      ...byCategory,
      query: {
        ...byCategory.query,
        where: E.cmp(E.field("amount"), "gt", E.lit(0)),
        measures: [...byCategory.query.measures, { key: "food", label: "Ăn", fn: "sum" as const, expr: { op: "if" as const, cond: E.cmp(E.field("cat"), "eq", E.lit("food")), then: E.lit(1), else: E.lit(0) } }],
      },
    };
    const scoredSpec = AppSpecSchema.parse(draft([scored]));
    expect(views(AppSpecSchema.parse(flatSpecToAppSpec(appSpecToFlatSpec(scoredSpec))))).toEqual(views(scoredSpec));
    // a function the AI may not use (optionPrices) keeps the view out of what the model sees
    const priced = { ...byCategory, query: { ...byCategory.query, derived: [{ key: "p", expr: E.call("optionPrices") }] } };
    expect(JSON.stringify(appSpecToFlatSpec(AppSpecSchema.parse(draft([priced]))))).not.toContain("summary");
  });

  it("never sends a query (it can hold the answers) to any screen", () => {
    const spec = AppSpecSchema.parse(draft([byCategory]));
    const pub = stripPrivateFields(spec, new Set());
    expect(JSON.stringify(pub)).not.toContain("$total.spent");
    expect((pub.blocks[0] as ComposeBlock).views[0]).toMatchObject({ kind: "summary", query: null });
  });

  it("reads conditions the way a model writes them: comparison as 1/0, value in v, missing else = 0", () => {
    const flat = appSpecToFlatSpec(AppSpecSchema.parse(draft([byCategory])));
    const view = (flat.blocks[0] as unknown as { views: Array<{ query: WireQuery }> }).views[0];
    view.query = {
      ...view.query,
      groupBy: "participant",
      where: { op: "gt", args: [{ op: "field", key: "amount" }], v: 0 },
      measures: [
        // guess within 5 of 42 → 10 points (no else)
        { key: "score", label: "Điểm", fn: "sum", field: null, expr: { op: "if", args: [{ op: "lte", args: [{ op: "abs", args: [{ op: "sub", args: [{ op: "field", key: "amount" }], v: 42 }] }], v: 5 }, { op: "lit", v: 10 }] } },
        // how many rows were food
        { key: "foods", label: null, fn: "sum", field: null, expr: { op: "eq", args: [{ op: "field", key: "cat" }, { op: "lit", v: "food" }] } },
      ],
      derived: [],
      sort: { key: "score", dir: "desc" },
    };
    const block = AppSpecSchema.parse(flatSpecToAppSpec(flat)).blocks[0] as ComposeBlock;
    const answers = [
      { who: "a", amount: 40, cat: "food" },
      { who: "a", amount: 100, cat: "fuel" },
      { who: "b", amount: 50, cat: "food" },
    ].map((r, i) => ({ blockId: "b", itemId: `e-${i}abcdef`, participantHash: r.who.repeat(64), displayName: r.who.toUpperCase(), payload: { kind: "compose" as const, values: { amount: r.amount, cat: r.cat } }, createdAt: i }));
    const table = computeComposeResults(block, answers, { appStatus: "active", runtime: { openQuestionId: null, revealedQuestionIds: [] }, viewer: { isHost: true, participantHash: null } }).views[0];
    expect(table).toMatchObject({ kind: "table", rows: [["A", 10, 1], ["B", 0, 1]] });
  });

  it("turns the model's flat tree into the query language (round → call, 'participant' → $participant)", () => {
    const flat = appSpecToFlatSpec(AppSpecSchema.parse(draft([byCategory])));
    const view = (flat.blocks[0] as unknown as { views: Array<{ query: WireQuery }> }).views[0];
    view.query = { ...view.query, groupBy: "participant", derived: [{ key: "pct", label: null, expr: { op: "round", args: [{ op: "div", args: [{ op: "field", key: "spent" }, { op: "field", key: "$total.spent" }] }, { op: "lit", v: 1 }] } }] };
    const parsed = AppSpecSchema.parse(flatSpecToAppSpec(flat)).blocks[0] as ComposeBlock;
    expect(parsed.views[0].query).toMatchObject({
      groupBy: "$participant",
      derived: [{ key: "pct", expr: { op: "call", fn: "round", args: [{ op: "div" }, { op: "lit", v: 1 }] } }],
    });
  });

  it("scans column labels for phishing like any other text people read", () => {
    const [spent, n] = byCategory.query.measures;
    const phishy = { ...byCategory, query: { ...byCategory.query, measures: [{ ...spent, label: "Nhập mật khẩu ngân hàng" }, n] } };
    expect(scanAppSpec(AppSpecSchema.parse(draft([phishy])), ["none"]).ok).toBe(false);
  });
});
