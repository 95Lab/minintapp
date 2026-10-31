// Query engine of the compose brick: every number a view shows (poll counts, averages, per-person
// totals, balances, order totals) is a query over the block's records, not a hand-written loop.
// A query is plain JSON — filter rows, group them, aggregate expressions per group, derive more
// columns from those aggregates — so a new calculation is data in the spec, not new code.
//
//   rows ─where→ kept rows ─groupBy→ groups ─measures→ {key: value} ─derived→ more keys ─sort/limit→ result
//
// Grand totals (`$total.<measure>`, the same aggregate over every kept row) and the group count
// (`$groups`) are in scope for derived expressions: "balance = paid − $total.paid / $groups".
import { z } from "zod";
import { Id, Text } from "../block-schema-primitives";
import type { ComposeRow } from "./compose-aggregation-helpers";
import { round2, selectedIds } from "./compose-value-basics";
import type { ComposeInput } from "./compose-atoms-schema";
import { evalExpr, evalFilter } from "./expression/expr-eval";
import { exprIssues, filterIssues } from "./expression/expr-issues";
import { ExprSchema, FilterSchema, rawTreeIssue, type Cell } from "./expression/expr-types";

export const AGGREGATES = ["count", "sum", "avg", "min", "max"] as const;
export type Aggregate = (typeof AGGREGATES)[number];
/** Group per participant (several list entries of one person add up) — the other choice is an input id. */
export const GROUP_BY_PARTICIPANT = "$participant";
export const TOTAL_PREFIX = "$total.";
export const GROUP_COUNT_KEY = "$groups";

/** Column name: letters first, then letters, digits, "_" or "-" (models name columns like ids, e.g. "total-spent"). */
const Key = z.string().regex(/^[a-z][a-z0-9_-]{0,31}$/i, "column key: start with a letter, then letters, digits, _ or - (max 32)");
const QueryObjectSchema = z.object({
  where: FilterSchema.nullable().default(null),
  /** null: one group of every row; "$participant"; or an input id (each picked option is a group) */
  groupBy: z.union([z.literal(GROUP_BY_PARTICIPANT), Id]).nullable().default(null),
  /** `count` without expr counts rows; with expr, rows where it isn't empty. Others skip non-numbers. */
  measures: z.array(z.object({ key: Key, label: Text.nullable().default(null), fn: z.enum(AGGREGATES), expr: ExprSchema.nullable().default(null) })).min(1).max(6),
  derived: z.array(z.object({ key: Key, label: Text.nullable().default(null), expr: ExprSchema })).max(6).default([]),
  sort: z.object({ key: z.string().min(1).max(40), dir: z.enum(["asc", "desc"]) }).nullable().default(null),
  limit: z.number().int().min(1).max(200).nullable().default(null),
});
/** Size and depth are checked on the raw JSON first: zod recursion and per-request work stay bounded. */
export const QuerySchema = z
  .unknown()
  .superRefine((raw, ctx) => {
    const issue = rawTreeIssue(raw);
    if (issue) ctx.addIssue({ code: "custom", message: issue });
  })
  .pipe(QueryObjectSchema);
export type Query = z.infer<typeof QueryObjectSchema>;
export type QueryDraft = z.input<typeof QueryObjectSchema>;

export interface QueryGroup {
  /** participant hash, picked option id, or "" for the single group */
  key: string;
  /** display name of the participant (participant groups only) */
  name: string | null;
  values: Record<string, Cell>;
}
export interface QueryResult {
  groups: QueryGroup[];
  /** every measure over all kept rows, plus `$groups` */
  totals: Record<string, Cell>;
}

const asCell = (v: ComposeRow["values"][string] | undefined): Cell => (v === undefined ? null : v);

function aggregate(fn: Aggregate, cells: Cell[], countRows: boolean): Cell {
  if (fn === "count") return countRows ? cells.length : cells.filter((c) => c !== null && c !== "").length;
  const numbers = cells.filter((c): c is number => typeof c === "number" && Number.isFinite(c));
  if (numbers.length === 0) return null;
  if (fn === "sum") return round2(numbers.reduce((a, b) => a + b, 0));
  if (fn === "avg") return round2(numbers.reduce((a, b) => a + b, 0) / numbers.length);
  return fn === "min" ? Math.min(...numbers) : Math.max(...numbers);
}

/** Group keys a row falls into: its participant, each picked option / rating / date of the input, or the one group. */
function groupKeys(row: ComposeRow, groupBy: string | null): string[] {
  if (groupBy === null) return [""];
  if (groupBy === GROUP_BY_PARTICIPANT) return [row.participantHash];
  const v = row.values[groupBy];
  return typeof v === "number" ? [String(v)] : selectedIds(v);
}

/** Runs a query over a block's records. Never throws: bad values become null cells. */
export function runQuery(query: Query, rows: readonly ComposeRow[], inputs: readonly ComposeInput[]): QueryResult {
  const ctxOf = (row: Record<string, Cell>) => ({ row, inputs });
  const kept = rows.filter((r) => !query.where || evalFilter(query.where, ctxOf(r.values as Record<string, Cell>)));

  const groups = new Map<string, { name: string | null; rows: ComposeRow[] }>();
  for (const row of kept) {
    for (const key of groupKeys(row, query.groupBy)) {
      const g = groups.get(key) ?? { name: query.groupBy === GROUP_BY_PARTICIPANT ? row.name : null, rows: [] };
      g.rows.push(row);
      groups.set(key, g);
    }
  }

  const measureOf = (m: Query["measures"][number], of: ComposeRow[]) =>
    aggregate(m.fn, of.map((r) => (m.expr ? evalExpr(m.expr, ctxOf(r.values as Record<string, Cell>)) : 1)), !m.expr);

  const totals: Record<string, Cell> = { [GROUP_COUNT_KEY]: groups.size };
  for (const m of query.measures) totals[m.key] = measureOf(m, kept);
  const totalScope = Object.fromEntries(query.measures.map((m) => [`${TOTAL_PREFIX}${m.key}`, totals[m.key]]));

  let out: QueryGroup[] = [...groups.entries()].map(([key, g]) => {
    const values: Record<string, Cell> = { ...totalScope, [GROUP_COUNT_KEY]: groups.size };
    for (const m of query.measures) values[m.key] = measureOf(m, g.rows);
    for (const d of query.derived) values[d.key] = evalExpr(d.expr, ctxOf(values));
    // Only the group's own columns leave the engine.
    const own = Object.fromEntries([...query.measures, ...query.derived].map((c) => [c.key, values[c.key]]));
    return { key, name: g.name, values: own };
  });

  if (query.sort) {
    const { key, dir } = query.sort;
    const sign = dir === "asc" ? 1 : -1;
    // Stable: ties keep first-answer order; empty values sort last either way.
    out = [...out].sort((a, b) => {
      const x = a.values[key];
      const y = b.values[key];
      if (typeof x !== "number" || typeof y !== "number") return (typeof x === "number" ? -1 : 0) + (typeof y === "number" ? 1 : 0);
      return (x - y) * sign;
    });
  }
  return { groups: query.limit ? out.slice(0, query.limit) : out, totals };
}

/** Save-time check of a query against the block's inputs: every name it uses exists, sorts by a real column. */
export function queryIssues(query: Query, inputs: readonly ComposeInput[]): string[] {
  const inputIds = new Set(inputs.map((i) => i.id));
  const issues: string[] = [];
  if (query.where) issues.push(...filterIssues(query.where, inputIds).map((m) => `where: ${m}`));
  if (query.groupBy !== null && query.groupBy !== GROUP_BY_PARTICIPANT) {
    const input = inputs.find((i) => i.id === query.groupBy);
    if (!input) issues.push(`groupBy: unknown input "${query.groupBy}"`);
    else if (input.kind === "text" || input.kind === "number") issues.push(`groupBy: cannot group by a ${input.kind} input`);
  }
  const columns = new Set<string>();
  for (const m of query.measures) {
    if (columns.has(m.key)) issues.push(`duplicate column "${m.key}"`);
    // The usual slip: the measure names an input the block never declared.
    if (m.expr?.op === "field" && !inputIds.has(m.expr.key)) issues.push(`measure ${m.key}: "${m.expr.key}" is not an input of this block — add a number input with id "${m.expr.key}" to inputs, or use one of: ${[...inputIds].join(", ") || "none"}`);
    else if (m.expr) issues.push(...exprIssues(m.expr, inputIds).map((msg) => `measure ${m.key}: ${msg}`));
    columns.add(m.key);
  }
  // Derived columns see the group's measures, earlier derived columns, grand totals and the group count.
  const scope = new Set([...columns, ...query.measures.map((m) => `${TOTAL_PREFIX}${m.key}`), GROUP_COUNT_KEY]);
  for (const d of query.derived) {
    if (columns.has(d.key)) issues.push(`duplicate column "${d.key}"`);
    issues.push(...exprIssues(d.expr, scope).map((msg) => `derived ${d.key}: ${msg}`));
    columns.add(d.key);
    scope.add(d.key);
  }
  if (query.sort && !columns.has(query.sort.key)) issues.push(`sort: unknown column "${query.sort.key}"`);
  return issues;
}
