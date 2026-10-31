// The built-in views as queries: poll bars, stats, leaderboards, bill split and order totals are
// each one query over the records (compose-query-engine.ts) plus formatting. These builders are the
// AI's shorthand vocabulary: the model picks `kind` + `source` + `op`, and the engine runs the query
// written here. The line price of an order is an expression too, shared with the phone's preview.
import type { Query } from "./compose-query-engine";
import { GROUP_BY_PARTICIPANT } from "./compose-query-engine";
import type { ComposeInput, ComposeValue, StatOp } from "./compose-atoms-schema";
import { evalExpr } from "./expression/expr-eval";
import { E, type Cell, type Expr, type Filter } from "./expression/expr-types";

type Column = { key: string; label?: string | null };
type Measure = Omit<Query["measures"][number], "label"> & Column;
type Derived = Omit<Query["derived"][number], "label"> & Column;
/** Internal queries skip parsing (e.g. a poll with 20 options needs a 20-way `or`); labels default to null. */
const query = (q: Partial<Omit<Query, "measures" | "derived">> & { measures: Measure[]; derived?: Derived[] }): Query => ({
  where: null,
  groupBy: null,
  sort: null,
  limit: null,
  ...q,
  measures: q.measures.map((m) => ({ label: null, ...m })),
  derived: (q.derived ?? []).map((d) => ({ label: null, ...d })),
});
/** Rows whose input holds a number (other values never count toward per-person totals). */
const hasNumber = (inputId: string): Filter => E.cmp(E.call("isNumber", E.field(inputId)), "eq", E.lit(true));

/** stat: one aggregate over every record (count without source = number of records). */
export function statQuery(op: StatOp, sourceId: string | null): Query {
  return query({ measures: [{ key: "value", fn: op, expr: sourceId ? E.field(sourceId) : null }] });
}

/** Votes per option: rows grouped by what they picked; `total` = rows with at least one known pick. */
export function barsQuery(sourceId: string, optionIds: string[], numeric: boolean): Query {
  const known: Filter = { op: "or", args: optionIds.map((id) => (numeric ? E.cmp(E.field(sourceId), "eq", E.lit(Number(id))) : E.cmp(E.field(sourceId), "has", E.lit(id)))) };
  return query({ where: known, groupBy: sourceId, measures: [{ key: "votes", fn: "count", expr: null }] });
}

/** Per person, several list entries combine (sum by default); best first. */
export function leaderboardQuery(sourceId: string, op: StatOp, topN: number): Query {
  return query({
    where: hasNumber(sourceId),
    groupBy: GROUP_BY_PARTICIPANT,
    measures: [{ key: "value", fn: op, expr: E.field(sourceId) }],
    sort: { key: "value", dir: "desc" },
    limit: topN,
  });
}

/**
 * Everyone who paid and what they paid in total. The equal share and balances are taken from the sum
 * of these rounded amounts (in the view), so balances always add up to zero.
 */
export function splitQuery(sourceId: string): Query {
  return query({ where: hasNumber(sourceId), groupBy: GROUP_BY_PARTICIPANT, measures: [{ key: "paid", fn: "sum", expr: E.field(sourceId) }] });
}

/** Quantity of one order: the quantity input (empty → 1, never below 0), or 1 without one. */
export function orderQtyExpr(qtyInputId: string | null): Expr {
  if (!qtyInputId) return E.lit(1);
  const q = E.field(qtyInputId);
  return { op: "if", cond: E.cmp(E.call("isNumber", q), "eq", E.lit(true)), then: E.call("max", E.lit(0), q), else: E.lit(1) };
}

/** Price of one order = Σ price of the picked options × quantity. */
export const orderLineExpr = (qtyInputId: string | null): Expr => E.call("round", E.mul(E.call("optionPrices"), orderQtyExpr(qtyInputId)), E.lit(2));

/** Order count, total quantity and total money over every record. */
export function ordersQuery(qtyInputId: string | null): Query {
  return query({
    measures: [
      { key: "count", fn: "count", expr: null },
      { key: "qty", fn: "sum", expr: orderQtyExpr(qtyInputId) },
      { key: "total", fn: "sum", expr: orderLineExpr(qtyInputId) },
    ],
  });
}

/** One order's quantity and price, for the phone's live preview (same expressions as the host's total). */
export function orderLineTotal(inputs: ComposeInput[], values: Record<string, ComposeValue>, qtyInputId: string | null): { qty: number; total: number } {
  const ctx = { row: values as Record<string, Cell>, inputs };
  const qty = evalExpr(orderQtyExpr(qtyInputId), ctx);
  const total = evalExpr(orderLineExpr(qtyInputId), ctx);
  return { qty: typeof qty === "number" ? qty : 1, total: typeof total === "number" ? total : 0 };
}
