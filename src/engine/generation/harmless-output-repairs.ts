// Slips a model makes that have exactly one sensible meaning are fixed here, before validation, instead
// of spending a repair call (on Groq's free tier a repair also waits a minute for quota). Measured in
// the generation eval; anything that needs a judgment call is left for validation to report.
const THEMES = ["ink", "sunset", "ocean", "forest"];
const QUIZ_DEFAULTS = { points: 100, timeLimitSec: 20 };
const MAX_VIEWS = 4;

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

/** text `max` counts words (1–50). Models write character limits like 200; the field's meaning is just "keep it short". */
function repairInput(input: unknown): unknown {
  if (!isObj(input) || input.kind !== "text" || input.max === null || input.max === undefined) return input;
  return Number.isInteger(input.max) && (input.max as number) >= 1 && (input.max as number) <= 50 ? input : { ...input, max: null };
}

/** A compose block with views but no inputs shows the block before it: its views belong there (a teams block is the one valid exception). */
function mergeResultBlocks(blocks: unknown[]): unknown[] {
  const out: unknown[] = [];
  for (const block of blocks) {
    const previous = out.at(-1);
    const views = isObj(block) && Array.isArray(block.views) ? block.views : [];
    const resultsOnly = isObj(block) && block.type === "compose" && !(Array.isArray(block.inputs) && block.inputs.length) && views.length > 0 && !views.some((v) => isObj(v) && v.kind === "teams");
    if (resultsOnly && isObj(previous) && previous.type === "compose" && Array.isArray(previous.views) && previous.views.length + views.length <= MAX_VIEWS) {
      out[out.length - 1] = { ...previous, views: [...previous.views, ...views] };
    } else out.push(block);
  }
  return out;
}

function repairBlock(b: unknown, index: number): unknown {
  if (!isObj(b)) return b;
  const out: Obj = { ...b };
  if (typeof out.type !== "string") {
    const type = inferType(out);
    if (type) out.type = type;
  }
  if (typeof out.id !== "string" || !out.id) out.id = `block${index + 1}`;
  if (out.type === "compose" && Array.isArray(out.inputs)) out.inputs = out.inputs.map(repairInput);
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
 * - a text input `max` outside 1–50 words → no limit;
 * - a compose block with only views → merged into the compose block before it;
 * - no riskFlags → ["none"] (the phishing scan still checks the spec).
 */
export function repairHarmlessSlips(raw: unknown): unknown {
  // risk flags left out: the server's own phishing scan runs on every spec regardless
  if (isObj(raw) && !Array.isArray(raw.riskFlags)) raw = { ...raw, riskFlags: ["none"] };
  if (!isObj(raw) || !isObj(raw.spec)) return raw;
  const spec: Obj = { ...raw.spec };
  if (!THEMES.includes(spec.theme as string)) spec.theme = "ink";
  if (Array.isArray(spec.blocks)) spec.blocks = mergeResultBlocks(spec.blocks.map(repairBlock));
  return { ...raw, spec };
}
