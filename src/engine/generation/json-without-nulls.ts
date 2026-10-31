// Prompt-size helper: JSON shown to a model without null-valued keys. Specs carry many "doesn't
// apply" nulls; dropping them cuts ~30% of their size, which matters for providers with a per-minute
// token quota (Groq free: 8 000 tokens/min against a ~7 000-token prompt).
export function withoutNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutNulls);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== null).map(([k, v]) => [k, withoutNulls(v)]));
}
