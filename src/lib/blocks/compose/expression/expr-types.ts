import { z } from "zod";
export type Cell = number | string | boolean | null | readonly string[];
export type Expr = { op: "field"; key: string } | { op: "lit"; v: number | string | boolean | null } | { op: "add" | "sub" | "mul" | "div"; args: [Expr, Expr] } | { op: "if"; cond: Filter; then: Expr; else: Expr } | { op: "call"; fn: string; args: Expr[] };
export type Filter = { op: "and"; args: Filter[] } | { op: "or"; args: Filter[] } | { op: "not"; arg: Filter } | { op: "cmp"; left: Expr; cmp: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "has" | "empty" | "notEmpty"; right: Expr | null };
export const MAX_EXPR_DEPTH = 6;
export const MAX_QUERY_NODES = 300;
export function rawTreeIssue(raw: unknown): string | null {
  const pending: [unknown, number][] = [[raw, 0]];
  let count = 0;
  while (pending.length) {
    const [value, depth] = pending.pop()!;
    if (++count > MAX_QUERY_NODES) return "Query exceeds 300 JSON nodes";
    if (depth > 32) return "Query JSON is too deeply nested";
    if (value && typeof value === "object") for (const child of Object.values(value)) pending.push([child, depth + 1]);
  }
  return null;
}
export const BoundedTree = z.unknown().superRefine((raw, ctx) => {
  const issue = rawTreeIssue(raw); if (issue) ctx.addIssue({ code: "custom", message: issue });
});
export const ExprSchema: z.ZodType<Expr> = z.lazy(() => z.union([
  z.strictObject({ op: z.literal("field"), key: z.string().min(1).max(40) }),
  z.strictObject({ op: z.literal("lit"), v: z.union([z.number().finite(), z.string().max(200), z.boolean(), z.null()]) }),
  z.strictObject({ op: z.enum(["add", "sub", "mul", "div"]), args: z.tuple([ExprSchema, ExprSchema]) }),
  z.strictObject({ op: z.literal("if"), cond: FilterSchema, then: ExprSchema, else: ExprSchema }),
  z.strictObject({ op: z.literal("call"), fn: z.string().min(1).max(40), args: z.array(ExprSchema).max(8) }),
]));
export const FilterSchema: z.ZodType<Filter> = z.lazy(() => z.union([
  z.strictObject({ op: z.enum(["and", "or"]), args: z.array(FilterSchema).min(1).max(8) }),
  z.strictObject({ op: z.literal("not"), arg: FilterSchema }),
  z.strictObject({ op: z.literal("cmp"), left: ExprSchema, cmp: z.enum(["eq", "ne", "gt", "gte", "lt", "lte", "has", "empty", "notEmpty"]), right: ExprSchema.nullable() }),
]));
export const E = {
  field: (key: string): Expr => ({ op: "field", key }), lit: (v: number | string | boolean | null): Expr => ({ op: "lit", v }),
  add: (a: Expr, b: Expr): Expr => ({ op: "add", args: [a, b] }), sub: (a: Expr, b: Expr): Expr => ({ op: "sub", args: [a, b] }),
  mul: (a: Expr, b: Expr): Expr => ({ op: "mul", args: [a, b] }), div: (a: Expr, b: Expr): Expr => ({ op: "div", args: [a, b] }),
  call: (fn: string, ...args: Expr[]): Expr => ({ op: "call", fn, args }),
  cmp: (left: Expr, cmp: Extract<Filter, { op: "cmp" }>["cmp"], right: Expr | null = null): Filter => ({ op: "cmp", left, cmp, right }),
};
