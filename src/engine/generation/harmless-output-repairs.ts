// Slips a model makes that have exactly one sensible meaning are fixed here, before validation, instead
// of spending a repair call (on Groq's free tier a repair also waits a minute for quota). Measured in
// the generation eval; anything that needs a judgment call is left for validation to report.
const THEMES = ["ink", "sunset", "ocean", "forest"];
const QUIZ_DEFAULTS = { points: 100, timeLimitSec: 20 };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);

/** The brick a block must be, from the fields it carries (only when `type` is missing). */
function inferType(b: Obj): string | null {
  if (b.questions) return "quiz";
  if (b.inputs || b.views || b.flow || b.entries) return "compose";
  if (typeof b.html === "string") return "custom";
  if (b.liveSource) return "live";
  if (b.removeWinner !== undefined || b.source === "participants") return "wheel";
  return null;
}

function repairBlock(b: unknown, index: number): unknown {
  if (!isObj(b)) return b;
  const out: Obj = { ...b };
  if (typeof out.type !== "string") {
    const type = inferType(out);
    if (type) out.type = type;
  }
  if (typeof out.id !== "string" || !out.id) out.id = `block${index + 1}`;
  // quiz: a question without points / time gets the documented defaults
  if (out.type === "quiz" && Array.isArray(out.questions)) {
    out.questions = out.questions.map((q) =>
      isObj(q) ? { ...q, points: typeof q.points === "number" ? q.points : QUIZ_DEFAULTS.points, timeLimitSec: typeof q.timeLimitSec === "number" ? q.timeLimitSec : QUIZ_DEFAULTS.timeLimitSec } : q,
    );
  }
  return out;
}

/**
 * - a colour theme outside the list → the default theme;
 * - a block without `type` whose fields make it unambiguous (inputs/views → compose, questions → quiz…);
 * - a block without `id` → "block<N>";
 * - a quiz question without points / time limit → 100 points / 20 s (the documented defaults);
 * - no riskFlags → ["none"] (the phishing scan still checks the spec).
 */
export function repairHarmlessSlips(raw: unknown): unknown {
  // risk flags left out: the server's own phishing scan runs on every spec regardless
  if (isObj(raw) && !Array.isArray(raw.riskFlags)) raw = { ...raw, riskFlags: ["none"] };
  if (!isObj(raw) || !isObj(raw.spec)) return raw;
  const spec: Obj = { ...raw.spec };
  if (!THEMES.includes(spec.theme as string)) spec.theme = "ink";
  if (Array.isArray(spec.blocks)) spec.blocks = spec.blocks.map(repairBlock);
  return { ...raw, spec };
}
