import type { ComposeInput } from "../compose-atoms-schema";
import { MAX_EXPR_DEPTH, type Cell, type Expr, type Filter } from "./expr-types";
export interface ExprContext { row: Readonly<Record<string, Cell>>; inputs: readonly ComposeInput[] }
export const FUNCTION_ARITY: Readonly<Record<string, readonly [number, number]>> = Object.freeze({ coalesce: [1, 8], round: [1, 2], abs: [1, 1], min: [1, 8], max: [1, 8], isNumber: [1, 1], countOf: [1, 1], optionPrices: [0, 0] });
const numeric = (v: Cell): v is number => typeof v === "number" && Number.isFinite(v);
const finite = (v: number): number | null => Number.isFinite(v) ? v : null;
const empty = (v: Cell) => v === null || v === "" || (Array.isArray(v) && !v.length);
function call(fn: string, args: Cell[], ctx: ExprContext): Cell {
  if (!Object.hasOwn(FUNCTION_ARITY, fn)) return null;
  const [min, max] = FUNCTION_ARITY[fn]; if (args.length < min || args.length > max) return null;
  if (fn === "coalesce") return args.find((v) => v !== null && v !== "") ?? null;
  if (fn === "isNumber") return numeric(args[0]);
  if (fn === "countOf") return Array.isArray(args[0]) ? args[0].length : typeof args[0] === "string" && args[0] ? 1 : 0;
  if (fn === "optionPrices") {
    let sum = 0;
    for (const input of ctx.inputs) {
      if (input.kind !== "choice" && input.kind !== "slot") continue;
      const value = ctx.row[input.id];
      const ids = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
      for (const id of ids) sum += input.options?.find((o) => o.id === id)?.price ?? 0;
    }
    return finite(sum);
  }
  if (!numeric(args[0])) return null;
  if (fn === "round") { const digits = numeric(args[1] ?? null) ? Math.max(0, Math.min(6, args[1] as number)) : 0; const factor = 10 ** digits; return finite(Math.round(args[0] * factor) / factor); }
  if (fn === "abs") return Math.abs(args[0]);
  if (!args.every(numeric)) return null;
  return fn === "min" ? Math.min(...args) : fn === "max" ? Math.max(...args) : null;
}
export function evalExpr(expr: Expr, ctx: ExprContext, depth = 1): Cell {
  if (depth > MAX_EXPR_DEPTH) return null;
  if (expr.op === "field") return Object.hasOwn(ctx.row, expr.key) ? ctx.row[expr.key] : null;
  if (expr.op === "lit") return expr.v;
  if (expr.op === "if") return evalExpr(evalFilter(expr.cond, ctx, depth + 1) ? expr.then : expr.else, ctx, depth + 1);
  if (expr.op === "call") return call(expr.fn, expr.args.map((e) => evalExpr(e, ctx, depth + 1)), ctx);
  const a = evalExpr(expr.args[0], ctx, depth + 1), b = evalExpr(expr.args[1], ctx, depth + 1);
  if (!numeric(a) || !numeric(b)) return null;
  return finite(expr.op === "add" ? a + b : expr.op === "sub" ? a - b : expr.op === "mul" ? a * b : b === 0 ? NaN : a / b);
}
export function evalFilter(filter: Filter, ctx: ExprContext, depth = 1): boolean {
  if (depth > MAX_EXPR_DEPTH) return false;
  if (filter.op === "and") return filter.args.every((f) => evalFilter(f, ctx, depth + 1));
  if (filter.op === "or") return filter.args.some((f) => evalFilter(f, ctx, depth + 1));
  if (filter.op === "not") return !evalFilter(filter.arg, ctx, depth + 1);
  const left = evalExpr(filter.left, ctx, depth + 1), right = filter.right ? evalExpr(filter.right, ctx, depth + 1) : null;
  if (filter.cmp === "empty") return empty(left);
  if (filter.cmp === "notEmpty") return !empty(left);
  if (filter.cmp === "has") return Array.isArray(left) && typeof right === "string" && left.includes(right);
  if (left === null || right === null) return false;
  if (filter.cmp === "eq") return left === right;
  if (filter.cmp === "ne") return left !== right;
  if (!numeric(left) || !numeric(right)) return false;
  return filter.cmp === "gt" ? left > right : filter.cmp === "gte" ? left >= right : filter.cmp === "lt" ? left < right : left <= right;
}
