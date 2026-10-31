// Expression language of the compose engine: a closed JSON tree, never a string to parse or eval.
// Adapted from the formula language of the author's earlier "nocode" platform (meta-derived /
// core-formula): literals, field reads, arithmetic, if/else, and calls to registered pure functions;
// conditions use a small filter tree. Values that don't fit propagate as null, like SQL.
import { z } from "zod";

/** A value flowing through expressions: answers are numbers, strings, id lists; booleans come from filters. */
export type Cell = number | string | boolean | null | readonly string[];

export const ARITH_OPS = ["add", "sub", "mul", "div"] as const;
export const CMP_OPS = ["eq", "ne", "gt", "gte", "lt", "lte", "has", "empty", "notEmpty"] as const;
export type CmpOp = (typeof CMP_OPS)[number];

export type Expr =
  | { op: "field"; key: string }
  | { op: "lit"; v: number | string | boolean | null }
  | { op: (typeof ARITH_OPS)[number]; args: [Expr, Expr] }
  | { op: "if"; cond: Filter; then: Expr; else: Expr }
  | { op: "call"; fn: string; args: Expr[] };

export type Filter =
  | { op: "and" | "or"; args: Filter[] }
  | { op: "not"; arg: Filter }
  /** `right` is unused for empty / notEmpty; `has` = the left list contains the right value */
  | { op: "cmp"; left: Expr; cmp: CmpOp; right: Expr | null };

/** Deepest nesting accepted (expressions and filters together) — keeps evaluation and schemas bounded. */
export const MAX_EXPR_DEPTH = 6;
/** Most JSON nodes one query may hold: evaluation cost per row is linear in it, so this caps CPU per results request. */
export const MAX_QUERY_NODES = 300;
/** Raw JSON nesting allowed before parsing (a query wraps expressions in a few object/array levels). */
const MAX_RAW_DEPTH = 4 * MAX_EXPR_DEPTH + 8;

/** Rejects oversized or absurdly deep JSON before a recursive schema walks it (no stack overflow, bounded work). */
export function rawTreeIssue(raw: unknown): string | null {
  let nodes = 0;
  const stack: Array<[unknown, number]> = [[raw, 1]];
  while (stack.length) {
    const [v, depth] = stack.pop()!;
    if (++nodes > MAX_QUERY_NODES) return `query too large (more than ${MAX_QUERY_NODES} parts)`;
    if (depth > MAX_RAW_DEPTH) return "query nested too deeply";
    if (v && typeof v === "object") for (const child of Object.values(v)) stack.push([child, depth + 1]);
  }
  return null;
}
const KEY = z.string().min(1).max(40);

export const ExprSchema: z.ZodType<Expr> = z.lazy(() =>
  z.union([
    z.object({ op: z.literal("field"), key: KEY }),
    z.object({ op: z.literal("lit"), v: z.union([z.number().finite(), z.string().max(200), z.boolean(), z.null()]) }),
    z.object({ op: z.enum(ARITH_OPS), args: z.tuple([ExprSchema, ExprSchema]) }),
    z.object({ op: z.literal("if"), cond: FilterSchema, then: ExprSchema, else: ExprSchema }),
    z.object({ op: z.literal("call"), fn: KEY, args: z.array(ExprSchema).max(8) }),
  ]),
);

export const FilterSchema: z.ZodType<Filter> = z.lazy(() =>
  z.union([
    z.object({ op: z.enum(["and", "or"]), args: z.array(FilterSchema).min(1).max(8) }),
    z.object({ op: z.literal("not"), arg: FilterSchema }),
    z.object({ op: z.literal("cmp"), left: ExprSchema, cmp: z.enum(CMP_OPS), right: ExprSchema.nullable() }),
  ]),
);

/** Every string literal anywhere in a tree (text people may read, for the phishing scan). */
export function stringLiterals(tree: unknown): string[] {
  if (!tree || typeof tree !== "object") return [];
  const node = tree as { op?: unknown; v?: unknown };
  const own = node.op === "lit" && typeof node.v === "string" && node.v ? [node.v] : [];
  return [...own, ...Object.values(tree).flatMap(stringLiterals)];
}

/** Shorthands for building trees in code (engine internals, templates, tests). */
export const E = {
  field: (key: string): Expr => ({ op: "field", key }),
  lit: (v: number | string | boolean | null): Expr => ({ op: "lit", v }),
  add: (a: Expr, b: Expr): Expr => ({ op: "add", args: [a, b] }),
  sub: (a: Expr, b: Expr): Expr => ({ op: "sub", args: [a, b] }),
  mul: (a: Expr, b: Expr): Expr => ({ op: "mul", args: [a, b] }),
  div: (a: Expr, b: Expr): Expr => ({ op: "div", args: [a, b] }),
  call: (fn: string, ...args: Expr[]): Expr => ({ op: "call", fn, args }),
  cmp: (left: Expr, cmp: CmpOp, right: Expr | null = null): Filter => ({ op: "cmp", left, cmp, right }),
};
