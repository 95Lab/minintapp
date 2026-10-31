// The AI's shape for a `summary` view's query, in the same flat, every-key-present style as the rest
// of the AI format so OpenAI strict, Gemini and LM Studio all accept it. One node shape for every
// expression and condition: `{op, key, v, args}`, depth-capped by unrolling (no `$ref`: some providers
// reject recursive schemas).
//   values      field (key = input id / measure key / "$total.<measure>") · lit (v = number or text)
//   arithmetic  add sub mul div · round abs min max coalesce
//   conditions  eq ne gt gte lt lte has empty notEmpty · and or not · if [cond, then, else]
// A condition used as a value is 1 / 0, so `sum` of a condition counts the rows where it holds and
// `if` scores answers ("10 points when q1 = b"). Measures may aggregate an expression, `where` keeps rows.
// wireToQuery → a query draft that AppSpecSchema validates (bad names → readable repair message);
// queryToWire → the inverse for few-shots and remix, or null when a hand-written query goes beyond
// this subset (the view is then left out of what the model sees).
import { z } from "zod";
import { jsonNullableEnum, jsonNullableInteger, jsonNullableString } from "../block-schema-primitives";
import { AGGREGATES, type Query, type QueryDraft } from "./compose-query-engine";
import type { CmpOp, Expr, Filter } from "./expression/expr-types";

/** Nesting the model may use, e.g. if(lte(abs(sub(guess, 42)), 5), 10, 0) = 4 operator levels. */
export const AI_EXPR_DEPTH = 4;
const LEAF_OPS = ["field", "lit"] as const;
const ARITH_OPS = ["add", "sub", "mul", "div"] as const;
const FN_OPS = ["round", "abs", "min", "max", "coalesce"] as const;
const CMP_OPS = ["eq", "ne", "gt", "gte", "lt", "lte", "has", "empty", "notEmpty"] as const;
const LOGIC_OPS = ["and", "or", "not"] as const;
const NODE_OPS = [...ARITH_OPS, ...FN_OPS, ...CMP_OPS, ...LOGIC_OPS, "if"] as const;

const isCmp = (op: string): op is CmpOp => (CMP_OPS as readonly string[]).includes(op);
const isLogic = (op: string) => (LOGIC_OPS as readonly string[]).includes(op);

function jsonExpr(depth: number): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      op: { enum: depth > 0 ? [...LEAF_OPS, ...NODE_OPS] : [...LEAF_OPS] },
      key: jsonNullableString,
      v: { type: ["number", "string", "null"] },
      args: depth > 0 ? { anyOf: [{ type: "array", items: jsonExpr(depth - 1) }, { type: "null" }] } : { type: "null" },
    },
    required: ["op", "key", "v", "args"],
    additionalProperties: false,
  };
}
const jsonNullableExpr = { anyOf: [jsonExpr(AI_EXPR_DEPTH), { type: "null" }] };

const jsonColumn = (extra: Record<string, unknown>, required: string[]) => ({
  type: "object",
  properties: { key: { type: "string" }, label: jsonNullableString, ...extra },
  required: ["key", "label", ...required],
  additionalProperties: false,
});

export const jsonQuery = {
  anyOf: [
    {
      type: "object",
      properties: {
        where: jsonNullableExpr,
        groupBy: jsonNullableString,
        measures: { type: "array", items: jsonColumn({ fn: { enum: [...AGGREGATES] }, field: jsonNullableString, expr: jsonNullableExpr }, ["fn", "field", "expr"]) },
        derived: { type: "array", items: jsonColumn({ expr: jsonExpr(AI_EXPR_DEPTH) }, ["expr"]) },
        sort: { anyOf: [{ type: "object", properties: { key: { type: "string" }, dir: jsonNullableEnum(["asc", "desc"]) }, required: ["key", "dir"], additionalProperties: false }, { type: "null" }] },
        limit: jsonNullableInteger,
      },
      required: ["where", "groupBy", "measures", "derived", "sort", "limit"],
      additionalProperties: false,
    },
    { type: "null" },
  ],
};

interface WireExpr {
  op: string;
  key?: string | null;
  v?: number | string | boolean | null;
  args?: WireExpr[] | null;
}
const wireExpr: z.ZodType<WireExpr> = z.lazy(() =>
  z.object({
    op: z.string(),
    key: z.string().nullable().optional(),
    v: z.union([z.number(), z.string(), z.boolean()]).nullable().optional(),
    args: z.array(wireExpr).nullable().optional(),
  }),
);
export const wireQuery = z.object({
  where: wireExpr.nullable().optional(),
  groupBy: z.string().nullable(),
  measures: z.array(z.object({ key: z.string(), label: z.string().nullable(), fn: z.string(), field: z.string().nullable(), expr: wireExpr.nullable().optional() })),
  derived: z.array(z.object({ key: z.string(), label: z.string().nullable(), expr: wireExpr })).nullable(),
  sort: z.object({ key: z.string(), dir: z.enum(["asc", "desc"]).nullable() }).nullable(),
  limit: z.number().nullable(),
});
export type WireQuery = z.infer<typeof wireQuery>;

const lit = (v: unknown) => ({ op: "lit", v: v ?? null });

/** Operands of a node; a value written in `v` of a one-operand node is its second operand (`{op:"mul", v:100, args:[x]}` = x × 100). */
function operands(w: WireExpr): WireExpr[] {
  const args = [...(w.args ?? [])];
  if (args.length === 1 && w.v !== null && w.v !== undefined) args.push({ op: "lit", v: w.v });
  return args;
}

/**
 * AI tree → condition. A comparison node compares its first two operands; anything else used as a
 * condition is "has a value". Unknown shapes pass through so validation names the problem.
 */
function toFilter(w: WireExpr): unknown {
  const args = operands(w);
  if (w.op === "and" || w.op === "or") return { op: w.op, args: args.map(toFilter) };
  if (w.op === "not") return { op: "not", arg: toFilter(args[0] ?? lit(null)) };
  if (isCmp(w.op)) {
    const unary = w.op === "empty" || w.op === "notEmpty";
    return { op: "cmp", left: toExpr(args[0] ?? lit(null)), cmp: w.op, right: unary ? null : toExpr(args[1] ?? lit(null)) };
  }
  return { op: "cmp", left: toExpr(w), cmp: "notEmpty", right: null };
}

/**
 * AI tree → expression. Harmless shape slips are normalized instead of spending a repair call:
 * a value in `v` of a one-operand node is its second operand; a+b+c written as one n-ary node folds
 * left; a single operand is itself; extra round() arguments are dropped; a condition used as a value
 * is 1 / 0; a missing `else` is 0.
 */
function toExpr(w: WireExpr): unknown {
  if (w.op === "field") return { op: "field", key: w.key ?? "" };
  if (w.op === "lit") return lit(w.v);
  if (isCmp(w.op) || isLogic(w.op)) return { op: "if", cond: toFilter(w), then: lit(1), else: lit(0) };
  const args = operands(w);
  if (w.op === "if") return { op: "if", cond: toFilter(args[0] ?? lit(null)), then: toExpr(args[1] ?? lit(null)), else: toExpr(args[2] ?? lit(0)) };
  const exprs = args.map(toExpr);
  if (w.op === "round") return { op: "call", fn: "round", args: exprs.slice(0, 2) };
  if ((FN_OPS as readonly string[]).includes(w.op)) return { op: "call", fn: w.op, args: exprs };
  if (exprs.length === 1) return exprs[0];
  if (exprs.length > 2) return exprs.slice(1).reduce((acc, next) => ({ op: w.op, args: [acc, next] }), exprs[0]);
  return { op: w.op, args: exprs };
}

export function wireToQuery(w: WireQuery): QueryDraft {
  return {
    where: w.where ? (toFilter(w.where) as Filter) : null,
    // "participant" is how a model naturally writes the per-person grouping
    groupBy: w.groupBy === "participant" ? "$participant" : w.groupBy || null,
    measures: w.measures.map((m) => ({
      key: m.key,
      label: m.label || null,
      fn: m.fn as QueryDraft["measures"][number]["fn"],
      expr: m.expr ? (toExpr(m.expr) as Expr) : m.field ? { op: "field", key: m.field } : null,
    })),
    derived: (w.derived ?? []).map((d) => ({ key: d.key, label: d.label || null, expr: toExpr(d.expr) as Expr })),
    sort: w.sort ? { key: w.sort.key, dir: w.sort.dir ?? "desc" } : null,
    limit: w.limit ? Math.round(w.limit) : null,
  };
}

const node = (op: string, args: WireExpr[]): WireExpr => ({ op, key: null, v: null, args });
const all = (xs: Array<WireExpr | null>): xs is WireExpr[] => xs.every((x) => x !== null);

/** Expression → AI tree, or null when it uses something outside the AI subset or nests too deep. */
function fromExpr(e: Expr, depth: number): WireExpr | null {
  if (e.op === "field") return { op: "field", key: e.key, v: null, args: null };
  if (e.op === "lit") return typeof e.v === "number" || typeof e.v === "string" ? { op: "lit", key: null, v: e.v, args: null } : null;
  if (depth === 0) return null;
  if (e.op === "if") {
    const parts = [fromFilter(e.cond, depth - 1), fromExpr(e.then, depth - 1), fromExpr(e.else, depth - 1)];
    return all(parts) ? node("if", parts) : null;
  }
  const args = e.op === "call" ? e.args : e.args;
  if (e.op === "call" && !(FN_OPS as readonly string[]).includes(e.fn)) return null;
  const inner = args.map((a) => fromExpr(a, depth - 1));
  return all(inner) ? node(e.op === "call" ? e.fn : e.op, inner) : null;
}

function fromFilter(f: Filter, depth: number): WireExpr | null {
  if (depth === 0) return null;
  if (f.op === "and" || f.op === "or") {
    const inner = f.args.map((a) => fromFilter(a, depth - 1));
    return all(inner) ? node(f.op, inner) : null;
  }
  if (f.op === "not") {
    const inner = fromFilter(f.arg, depth - 1);
    return inner ? node("not", [inner]) : null;
  }
  if (f.op !== "cmp") return null;
  const sides = [fromExpr(f.left, depth - 1), ...(f.right ? [fromExpr(f.right, depth - 1)] : [])];
  return all(sides) ? node(f.cmp, sides) : null;
}

export function queryToWire(q: Query): WireQuery | null {
  // Hand-written drafts may leave defaults out (no label, no limit…): the AI format always has every key.
  const where = q.where ? fromFilter(q.where, AI_EXPR_DEPTH) : null;
  const measures = q.measures.map((m) => {
    const base = { key: m.key, label: m.label ?? null, fn: m.fn };
    if (!m.expr) return { ...base, field: null, expr: null };
    if (m.expr.op === "field") return { ...base, field: m.expr.key, expr: null };
    const expr = fromExpr(m.expr, AI_EXPR_DEPTH);
    return expr ? { ...base, field: null, expr } : null;
  });
  const derived = (q.derived ?? []).map((d) => {
    const expr = fromExpr(d.expr, AI_EXPR_DEPTH);
    return expr ? { key: d.key, label: d.label ?? null, expr } : null;
  });
  if ((q.where && !where) || measures.some((m) => m === null) || derived.some((d) => d === null)) return null;
  return {
    where,
    groupBy: q.groupBy ?? null,
    measures: measures as WireQuery["measures"],
    derived: derived as NonNullable<WireQuery["derived"]>,
    sort: q.sort ?? null,
    limit: q.limit ?? null,
  };
}
