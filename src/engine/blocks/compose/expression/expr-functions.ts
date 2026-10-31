// Registered pure functions callable from expressions (`{op:"call", fn, args}`). Each one is total —
// it never throws, bad input gives null — and deterministic. Adding a function here is the only way
// to extend what expressions can compute; the evaluator itself never changes.
import type { ComposeInput } from "../compose-atoms-schema";
import type { Cell } from "./expr-types";

/** What a function may look at besides its arguments: the current row and the block's inputs. */
export interface ExprContext {
  row: Readonly<Record<string, Cell>>;
  inputs: readonly ComposeInput[];
}

export type ExprFn = (args: Cell[], ctx: ExprContext) => Cell;

export const num = (v: Cell): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const ids = (v: Cell): readonly string[] => (Array.isArray(v) ? v : typeof v === "string" && v ? [v] : []);

const FUNCTIONS: Record<string, { arity: [min: number, max: number]; fn: ExprFn }> = {
  /** first non-null argument */
  coalesce: { arity: [1, 8], fn: (args) => args.find((a) => a !== null && a !== "") ?? null },
  round: {
    arity: [1, 2],
    fn: ([x, digits]) => {
      const n = num(x);
      if (n === null) return null;
      const f = 10 ** Math.max(0, Math.min(6, num(digits ?? 0) ?? 0));
      return Math.round(n * f) / f;
    },
  },
  abs: { arity: [1, 1], fn: ([x]) => (num(x) === null ? null : Math.abs(num(x)!)) },
  min: { arity: [1, 8], fn: (args) => (args.every((a) => num(a) !== null) ? Math.min(...args.map((a) => num(a)!)) : null) },
  max: { arity: [1, 8], fn: (args) => (args.every((a) => num(a) !== null) ? Math.max(...args.map((a) => num(a)!)) : null) },
  isNumber: { arity: [1, 1], fn: ([v]) => num(v) !== null },
  /** number of picks in a choice input (multi-choice) */
  countOf: { arity: [1, 1], fn: ([v]) => ids(v).length },
  /**
   * Σ price of every option picked in the row across all choice/slot inputs (group-order line price).
   * Ignores its arguments; prices come from the block definition, never from the answer.
   */
  optionPrices: {
    arity: [0, 0],
    fn: (_args, { row, inputs }) => {
      let sum = 0;
      for (const input of inputs) {
        if (input.kind !== "choice" && input.kind !== "slot") continue;
        for (const id of ids(row[input.id] ?? null)) sum += input.options?.find((o) => o.id === id)?.price ?? 0;
      }
      return sum;
    },
  },
};


export function functionSpec(name: string): { arity: [number, number]; fn: ExprFn } | undefined {
  return Object.hasOwn(FUNCTIONS, name) ? FUNCTIONS[name] : undefined;
}
