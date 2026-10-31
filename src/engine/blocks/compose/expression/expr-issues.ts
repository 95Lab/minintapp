// Save-time checks for expressions (the same checks for AI output, templates and hand-written specs):
// every field it reads exists in scope, every function is registered with the right number of
// arguments, and nesting stays bounded. Returns readable messages — never throws — because a
// model inventing an op must be told why, not crash the request.
import { functionSpec } from "./expr-functions";
import { MAX_EXPR_DEPTH, type Expr, type Filter } from "./expr-types";

export function exprIssues(e: Expr, scope: ReadonlySet<string>, depth = 1): string[] {
  if (depth > MAX_EXPR_DEPTH) return [`expression nested deeper than ${MAX_EXPR_DEPTH}`];
  switch (e.op) {
    case "lit":
      return [];
    case "field":
      return scope.has(e.key) ? [] : [`unknown field "${e.key}" (available: ${[...scope].join(", ") || "none"})`];
    case "add":
    case "sub":
    case "mul":
    case "div":
      return e.args.flatMap((a) => exprIssues(a, scope, depth + 1));
    case "if":
      return [...filterIssues(e.cond, scope, depth + 1), ...exprIssues(e.then, scope, depth + 1), ...exprIssues(e.else, scope, depth + 1)];
    case "call": {
      const spec = functionSpec(e.fn);
      if (!spec) return [`unknown function "${e.fn}"`];
      const [min, max] = spec.arity;
      const arity = e.args.length < min || e.args.length > max ? [`function "${e.fn}" takes ${min === max ? min : `${min}–${max}`} argument(s), got ${e.args.length}`] : [];
      return [...arity, ...e.args.flatMap((a) => exprIssues(a, scope, depth + 1))];
    }
  }
}

export function filterIssues(f: Filter, scope: ReadonlySet<string>, depth = 1): string[] {
  if (depth > MAX_EXPR_DEPTH) return [`filter nested deeper than ${MAX_EXPR_DEPTH}`];
  switch (f.op) {
    case "and":
    case "or":
      return f.args.flatMap((a) => filterIssues(a, scope, depth + 1));
    case "not":
      return filterIssues(f.arg, scope, depth + 1);
    case "cmp": {
      const needsRight = f.cmp !== "empty" && f.cmp !== "notEmpty";
      const right = needsRight && !f.right ? [`comparison "${f.cmp}" needs a right-hand value`] : [];
      return [...right, ...exprIssues(f.left, scope, depth + 1), ...(f.right ? exprIssues(f.right, scope, depth + 1) : [])];
    }
  }
}
