// Leaf helpers on stored answer values, with no imports: the schema → query engine → helpers chain
// must not loop back into the schema module, or the browser bundle reads a binding before it exists.

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Picked ids of a choice/slot/person value: a list, one id, or nothing. */
export const selectedIds = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : typeof v === "string" && v ? [v] : []);
