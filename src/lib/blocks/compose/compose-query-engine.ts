import { z } from "zod";
import { Id, Text } from "../block-schema-primitives";
import type { ComposeInput } from "./compose-atoms-schema";
import { BoundedTree, ExprSchema, FilterSchema, type Cell } from "./expression/expr-types";
import { evalExpr, evalFilter } from "./expression/expr-eval";
import { exprIssues, filterIssues } from "./expression/expr-issues";
const Key = Id.refine((k) => /^[a-z][a-z0-9_-]{0,31}$/i.test(k), "Invalid query column key");
export const QueryObjectSchema = z.strictObject({
  where: FilterSchema.nullable().default(null), groupBy: z.union([Id, z.literal("$participant")]).nullable().default(null),
  measures: z.array(z.strictObject({ key: Key, label: Text.nullable().default(null), fn: z.enum(["count", "sum", "avg", "min", "max"]), expr: ExprSchema.nullable().default(null) })).min(1).max(6),
  derived: z.array(z.strictObject({ key: Key, label: Text.nullable().default(null), expr: ExprSchema })).max(6).default([]),
  sort: z.strictObject({ key: z.string().min(1).max(40), dir: z.enum(["asc", "desc"]) }).nullable().default(null),
  limit: z.number().int().min(1).max(200).nullable().default(null),
});
export const QuerySchema = BoundedTree.pipe(QueryObjectSchema);
export type Query = z.output<typeof QuerySchema>;
export interface QueryRow { participantHash: string; name: string | null; values: Record<string, Cell> }
export interface QueryGroup { key: string; name: string | null; values: Record<string, Cell> }
export function aggregate(fn: Query["measures"][number]["fn"], values: Cell[], countRows = false): Cell {
  if (fn === "count") return countRows ? values.length : values.filter((v) => v !== null && v !== "").length;
  const numbers = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (!numbers.length) return null;
  const value = fn === "min" ? Math.min(...numbers) : fn === "max" ? Math.max(...numbers) : numbers.reduce((a, b) => a + b, 0) / (fn === "avg" ? numbers.length : 1);
  const rounded = Math.round(value * 100) / 100;
  return Number.isFinite(rounded) ? rounded : null;
}
export function queryIssues(query: Query, inputs: readonly ComposeInput[]): string[] {
  const scope = new Set(inputs.map((i) => i.id));
  const issues = query.where ? filterIssues(query.where, scope) : [];
  if (query.groupBy && query.groupBy !== "$participant") {
    const input = inputs.find((i) => i.id === query.groupBy);
    if (!input || ["text", "number"].includes(input.kind)) issues.push("Invalid query groupBy");
  }
  const columns = new Set<string>();
  for (const m of query.measures) {
    if (columns.has(m.key)) issues.push(`Duplicate column ${m.key}`);
    columns.add(m.key); if (m.expr) issues.push(...exprIssues(m.expr, scope));
  }
  const derivedScope = new Set([...columns, ...query.measures.map((m) => `$total.${m.key}`), "$groups"]);
  for (const d of query.derived) {
    if (columns.has(d.key)) issues.push(`Duplicate column ${d.key}`);
    issues.push(...exprIssues(d.expr, derivedScope)); columns.add(d.key); derivedScope.add(d.key);
  }
  if (query.sort && !columns.has(query.sort.key)) issues.push("Unknown sort column");
  return issues;
}
export function runQuery(query: Query, rows: readonly QueryRow[], inputs: readonly ComposeInput[]) {
  const kept = rows.filter((r) => !query.where || evalFilter(query.where, { row: r.values, inputs }));
  const grouped = new Map<string, { rows: QueryRow[]; name: string | null }>();
  for (const row of kept) {
    const value = query.groupBy ? row.values[query.groupBy] : null;
    const keys = query.groupBy === null ? [""] : query.groupBy === "$participant" ? [row.participantHash] : Array.isArray(value) ? value : typeof value === "number" || typeof value === "string" && value ? [String(value)] : [];
    for (const key of keys) { const group = grouped.get(key) ?? { rows: [], name: query.groupBy === "$participant" ? row.name : null }; group.rows.push(row); grouped.set(key, group); }
  }
  const measure = (m: Query["measures"][number], rs: readonly QueryRow[]) => aggregate(m.fn, rs.map((r) => m.expr ? evalExpr(m.expr, { row: r.values, inputs }) : 1), !m.expr);
  const totals: Record<string, Cell> = Object.fromEntries(query.measures.map((m) => [m.key, measure(m, kept)])); totals.$groups = grouped.size;
  let groups: QueryGroup[] = [...grouped].map(([key, group]) => {
    const scope: Record<string, Cell> = Object.fromEntries(query.measures.map((m) => [`$total.${m.key}`, totals[m.key]])); scope.$groups = grouped.size;
    for (const m of query.measures) scope[m.key] = measure(m, group.rows);
    for (const d of query.derived) scope[d.key] = evalExpr(d.expr, { row: scope, inputs });
    return { key, name: group.name, values: Object.fromEntries([...query.measures, ...query.derived].map((m) => [m.key, scope[m.key]])) };
  });
  if (query.sort) { const { key, dir } = query.sort; groups.sort((a, b) => { const x = a.values[key], y = b.values[key]; if (typeof x !== "number" || typeof y !== "number") return (typeof x === "number" ? -1 : 0) + (typeof y === "number" ? 1 : 0); return (x - y) * (dir === "asc" ? 1 : -1); }); }
  return { groups: query.limit ? groups.slice(0, query.limit) : groups, totals };
}
