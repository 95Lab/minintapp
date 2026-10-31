import { FUNCTION_ARITY } from "./expr-eval";
import { MAX_EXPR_DEPTH, type Expr, type Filter } from "./expr-types";
export function exprIssues(expr: Expr, scope: ReadonlySet<string>, depth = 1): string[] {
  if (depth > MAX_EXPR_DEPTH) return ["Expression exceeds depth 6"];
  if (expr.op === "field") return scope.has(expr.key) ? [] : [`Unknown field ${expr.key}`];
  if (expr.op === "lit") return [];
  if (expr.op === "if") return [...filterIssues(expr.cond, scope, depth + 1), ...exprIssues(expr.then, scope, depth + 1), ...exprIssues(expr.else, scope, depth + 1)];
  const issues = expr.args.flatMap((e) => exprIssues(e, scope, depth + 1));
  if (expr.op === "call") {
    const arity = Object.hasOwn(FUNCTION_ARITY, expr.fn) ? FUNCTION_ARITY[expr.fn] : undefined;
    if (!arity || expr.args.length < arity[0] || expr.args.length > arity[1]) issues.push(`Unknown function or invalid arity: ${expr.fn}`);
  }
  return issues;
}
export function filterIssues(filter: Filter, scope: ReadonlySet<string>, depth = 1): string[] {
  if (depth > MAX_EXPR_DEPTH) return ["Filter exceeds depth 6"];
  if (filter.op === "and" || filter.op === "or") return filter.args.flatMap((f) => filterIssues(f, scope, depth + 1));
  if (filter.op === "not") return filterIssues(filter.arg, scope, depth + 1);
  return [...exprIssues(filter.left, scope, depth + 1), ...(filter.right ? exprIssues(filter.right, scope, depth + 1) : [])];
}
