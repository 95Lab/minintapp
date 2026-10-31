// A model may leave out fields that would be null (the few-shot examples omit them to keep the prompt
// small, and providers without constrained decoding — Groq JSON mode — don't add them back). Walking
// the output JSON schema, every missing required key whose schema allows null is set to null, so
// "left out" and "null" mean the same thing. Anything else (wrong types, missing non-null keys) is
// left for validation to report.
type Schema = Record<string, unknown>;

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const types = (s: Schema): unknown[] => (Array.isArray(s.type) ? s.type : s.type === undefined ? [] : [s.type]);

function allowsNull(s: Schema | undefined): boolean {
  if (!s) return false;
  if (types(s).includes("null")) return true;
  if (Array.isArray(s.enum) && s.enum.includes(null)) return true;
  return Array.isArray(s.anyOf) && (s.anyOf as Schema[]).some(allowsNull);
}

/** The anyOf branch describing this value's shape (object / array), if any. */
function branchFor(s: Schema, v: unknown): Schema | undefined {
  const branches = (s.anyOf as Schema[] | undefined) ?? [s];
  return branches.find((b) => (isObject(v) && (types(b).includes("object") || !!b.properties)) || (Array.isArray(v) && (types(b).includes("array") || !!b.items)));
}

export function fillOmittedNulls(value: unknown, schema: Schema): unknown {
  const s = branchFor(schema, value);
  if (!s) return value;
  if (Array.isArray(value)) return s.items ? value.map((item) => fillOmittedNulls(item, s.items as Schema)) : value;
  if (!isObject(value) || !s.properties) return value;
  const props = s.properties as Record<string, Schema>;
  const out: Record<string, unknown> = { ...value };
  for (const key of (s.required as string[] | undefined) ?? []) {
    if (!(key in out) && allowsNull(props[key])) out[key] = null;
  }
  for (const key of Object.keys(out)) if (props[key]) out[key] = fillOmittedNulls(out[key], props[key]);
  return out;
}
