// Tree-walking evaluator: no eval, no Function, no string parsing. Null propagates through arithmetic
// (like SQL), division by zero is null (never Infinity), unknown functions return null, and depth is
// bounded by validation — so a bad expression yields a null cell, never a crash of the whole result.
import { functionSpec, num, type ExprContext } from "./expr-functions";
import type { Cell, Expr, Filter } from "./expr-types";

const isEmpty = (v: Cell) => v === null || v === "" || (Array.isArray(v) && v.length === 0);

export function evalExpr(e: Expr, ctx: ExprContext): Cell {
  switch (e.op) {
    case "lit":
      return e.v;
    case "field":
      return Object.hasOwn(ctx.row, e.key) ? (ctx.row[e.key] ?? null) : null;
    case "add":
    case "sub":
    case "mul":
    case "div": {
      const a = num(evalExpr(e.args[0], ctx));
      const b = num(evalExpr(e.args[1], ctx));
      if (a === null || b === null) return null;
      if (e.op === "add") return a + b;
      if (e.op === "sub") return a - b;
      if (e.op === "mul") return a * b;
      return b === 0 ? null : a / b;
    }
    case "if":
      return evalFilter(e.cond, ctx) ? evalExpr(e.then, ctx) : evalExpr(e.else, ctx);
    case "call": {
      const spec = functionSpec(e.fn);
      if (!spec) return null;
      return spec.fn(e.args.map((a) => evalExpr(a, ctx)), ctx);
    }
  }
}

function compare(left: Cell, cmp: Exclude<Filter & { op: "cmp" }, never>["cmp"], right: Cell): boolean {
  switch (cmp) {
    case "empty":
      return isEmpty(left);
    case "notEmpty":
      return !isEmpty(left);
    case "has":
      return Array.isArray(left) ? right !== null && left.includes(String(right)) : left !== null && left === right;
    case "eq":
      return left === right;
    case "ne":
      return left !== right;
    default: {
      // Ordering compares numbers, or strings (ISO dates sort correctly as text); mixed → false.
      const bothNumbers = num(left) !== null && num(right) !== null;
      const bothStrings = typeof left === "string" && typeof right === "string";
      if (!bothNumbers && !bothStrings) return false;
      const [a, b] = [left as number | string, right as number | string];
      return cmp === "gt" ? a > b : cmp === "gte" ? a >= b : cmp === "lt" ? a < b : a <= b;
    }
  }
}

export function evalFilter(f: Filter, ctx: ExprContext): boolean {
  switch (f.op) {
    case "and":
      return f.args.every((a) => evalFilter(a, ctx));
    case "or":
      return f.args.some((a) => evalFilter(a, ctx));
    case "not":
      return !evalFilter(f.arg, ctx);
    case "cmp":
      return compare(evalExpr(f.left, ctx), f.cmp, f.right ? evalExpr(f.right, ctx) : null);
  }
}
