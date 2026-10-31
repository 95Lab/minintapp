import { describe, expect, it } from "vitest";
import { composeTemplate } from "@/lib/templates/compose-templates";
import { MemoryAppsRepository } from "@/lib/db/memory-apps-repository";
import { validatePollResponse } from "@/lib/responses/validate-response-payload";
import { AppSpecSchema } from "@/lib/app-spec/app-spec-schema";
import { computeComposeResults } from "@/lib/blocks/compose/compute-compose-results";
import { QuerySchema, queryIssues, runQuery, aggregate } from "@/lib/blocks/compose/compose-query-engine";
import { E, type Expr } from "@/lib/blocks/compose/expression/expr-types";
import { evalExpr } from "@/lib/blocks/compose/expression/expr-eval";
import { appsRepository } from "@/lib/db/apps-repository";
import { readAppState } from "@/lib/api/poll-service";
const spec = (name: string) => composeTemplate(`compose-${name}`, "vi")!;
const block = (name: string) => { const b = spec(name).blocks[0]; if (b.type !== "compose") throw Error(); return b; };
const response = (values: Record<string, string | number | string[]>, itemId = "", who = "person-one") => ({ blockId: "form", itemId, participantHash: who, displayName: "Lan", payload: { kind: "compose" as const, values } });
const create = (repo: MemoryAppsRepository, name: string) => repo.createApp({ spec: spec(name), prompt: "", lifetimeMs: 3600000 });
describe("compose validation", () => {
  it("validates multi-select, conditions, required values, numeric ranges and real dates", () => {
    const s = spec("survey");
    const valid = { topics: ["tech", "design"], detail: "Tốt", score: 5, date: "2028-02-29" };
    const validate = (values: typeof valid | Record<string, unknown>) => validatePollResponse(s, "form", "", { kind: "compose", values } as never);
    expect(() => validate(valid)).not.toThrow();
    for (const values of [{ ...valid, topics: ["tech", "tech"] }, { ...valid, detail: "" }, { ...valid, score: 6 }, { ...valid, score: 1.5 }, { ...valid, date: "2027-02-29" }, { ...valid, extra: 1 }, { ...valid, topics: ["design"] }]) expect(() => validate(values)).toThrow();
    expect(() => validate({ topics: ["design"], score: 4, date: "2026-10-31" })).not.toThrow();
  });
  it("rejects incompatible flow and invalid query wiring at save time", () => {
    const s = spec("steps"); const b = s.blocks[0]; if (b.type !== "compose") throw Error();
    b.entries = "many"; expect(AppSpecSchema.safeParse(s).success).toBe(false);
    const expense = spec("expenses"); const e = expense.blocks[0]; if (e.type !== "compose") throw Error();
    e.views[1].query!.measures[0].expr = E.field("missing"); expect(AppSpecSchema.safeParse(expense).success).toBe(false);
  });
});
describe("compose records and steps", () => {
  it("upserts, isolates deletion by participant and atomically caps 50 records per person", async () => {
    const repo = new MemoryAppsRepository(); const { app } = await create(repo, "expenses");
    const row = response({ note: "Ăn", amount: 10 }, "e-abcdef");
    expect(await repo.submitResponse(app.id, row)).toBe("ok");
    await repo.submitResponse(app.id, { ...row, participantHash: "other" });
    await repo.submitResponse(app.id, response({ note: "Ăn", amount: 20 }, "e-abcdef"));
    expect(await repo.listResponses(app.id)).toHaveLength(2);
    await repo.submitResponse(app.id, { ...row, payload: { kind: "compose", removed: true, values: {} } });
    expect((await repo.listResponses(app.id))[0].participantHash).toBe("other");
    const outcomes = await Promise.all(Array.from({ length: 60 }, (_, i) => repo.submitResponse(app.id, response({ note: "Khoản chi", amount: i }, `e-${String(i).padStart(6, "0")}`))));
    expect(outcomes.filter((v) => v === "ok")).toHaveLength(50);
    expect(outcomes.filter((v) => v === "limit")).toHaveLength(10);
    await expect(repo.submitResponse(app.id, response({ amount: 1, note: "X" }, "bad"))).rejects.toMatchObject({ code: "invalid_request" });
  });
  it("enforces host steps and the server deadline with 2-second grace, retaining answers on restart", async () => {
    let now = 10000; const repo = new MemoryAppsRepository(() => now); const { app, hostToken } = await create(repo, "steps");
    const row = response({ content: 4 }, "content");
    await expect(repo.submitResponse(app.id, row)).rejects.toMatchObject({ code: "question_closed" });
    await expect(repo.blockAction(app.id, "wrong", { blockId: "form", action: "next" })).rejects.toMatchObject({ code: "forbidden" });
    await repo.blockAction(app.id, hostToken, { blockId: "form", action: "next" });
    await expect(repo.submitResponse(app.id, response({ delivery: 4 }, "delivery"))).rejects.toMatchObject({ code: "question_closed" });
    now += 32000; expect(await repo.submitResponse(app.id, row)).toBe("ok");
    now++; await expect(repo.submitResponse(app.id, row)).rejects.toMatchObject({ code: "question_closed" });
    await repo.blockAction(app.id, hostToken, { blockId: "form", action: "next" });
    expect((await repo.findApp(app.id))?.runtime.blocks.form.step?.done).toEqual(["content"]);
    await repo.submitResponse(app.id, response({ delivery: 5 }, "delivery"));
    const results = computeComposeResults(block("steps"), await repo.listResponses(app.id));
    expect(results.map((r) => r.value)).toEqual([4, 5]);
    await repo.blockAction(app.id, hostToken, { blockId: "form", action: "close" });
    await repo.blockAction(app.id, hostToken, { blockId: "form", action: "restart" });
    expect(await repo.listResponses(app.id)).toHaveLength(2);
    expect((await repo.findApp(app.id))?.runtime.blocks.form.step?.current).toBeNull();
  });
  it("publishes after_step only after close and keeps hidden views and participant hashes private", async () => {
    const { app, hostToken } = await appsRepository.createApp({ spec: spec("steps"), prompt: "", lifetimeMs: 3600000 });
    const read = (host = false) => readAppState(new Request("http://local", { headers: host ? { "x-host-view": "1", "x-host-token": hostToken } : {} }), app.id);
    await appsRepository.blockAction(app.id, hostToken, { blockId: "form", action: "next" });
    await appsRepository.submitResponse(app.id, response({ content: 4 }, "content", "private-full-hash"));
    expect((await read()).results).toEqual([]);
    expect((await read(true)).results).toHaveLength(2);
    await appsRepository.blockAction(app.id, hostToken, { blockId: "form", action: "close" });
    const state = await read(); expect(state.results).toHaveLength(1);
    expect(JSON.stringify(state)).not.toContain("private-full-hash");
  });
});
describe("expression and query", () => {
  it("filters, groups, aggregates, derives from totals, sorts and removes internal group hashes", () => {
    const b = block("expenses"); const query = b.views[1].query!;
    query.where = E.cmp(E.field("amount"), "gt", E.lit(0));
    const result = runQuery(query, [
      { participantHash: "a", name: "Lan", values: { amount: 20 } }, { participantHash: "a", name: "Lan", values: { amount: 10 } },
      { participantHash: "b", name: "Mai", values: { amount: 10 } }, { participantHash: "c", name: "X", values: { amount: -1 } },
    ], b.inputs);
    expect(result.groups.map((g) => g.values)).toEqual([{ total: 30, count: 2, percent: 75 }, { total: 10, count: 1, percent: 25 }]);
    const publicResult = computeComposeResults(b, [{ ...response({ note: "Ăn", amount: 20 }, "e-abcdef", "secret-hash"), createdAt: 0 }]);
    expect(JSON.stringify(publicResult)).not.toContain("secret-hash");
    expect(publicResult[1].rows?.[0].label).toBe("Lan");
  });
  it("handles null, division by zero, overflow and option prices without executing code", () => {
    const ctx = { row: { topics: ["tech"] }, inputs: block("survey").inputs };
    ctx.inputs[0].options![0].price = 12;
    expect(evalExpr(E.call("optionPrices"), ctx)).toBe(12);
    expect(evalExpr(E.div(E.lit(1), E.lit(0)), ctx)).toBeNull();
    expect(evalExpr(E.mul(E.lit(1e308), E.lit(2)), ctx)).toBeNull();
    expect(evalExpr(E.call("constructor"), ctx)).toBeNull();
    expect(evalExpr(E.field("constructor"), ctx)).toBeNull();
    expect(aggregate("avg", [null, "3"])).toBeNull();
    expect(aggregate("sum", [1e308])).toBeNull();
    expect(aggregate("count", [])).toBe(0);
  });
  it("rejects unknown names, function arity, forward derived references and excessive trees", () => {
    const b = block("expenses"); const q = b.views[1].query!;
    q.measures[0].expr = E.call("abs", E.lit(1), E.lit(2)); expect(queryIssues(q, b.inputs)).toContain("Unknown function or invalid arity: abs");
    q.derived[0].expr = E.field("future"); expect(queryIssues(q, b.inputs)).toContain("Unknown field future");
    let expr: Expr = E.lit(1); for (let i = 0; i < 8; i++) expr = E.call("abs", expr);
    q.measures[0].expr = expr; expect(queryIssues(q, b.inputs).join()).toContain("depth 6");
    for (let i = 0; i < 40; i++) expr = E.call("abs", expr);
    q.measures[0].expr = expr; expect(QuerySchema.safeParse(q).success).toBe(false);
  });
});
