// Structural rules for a compose block: every view reads an input it can make sense of, conditions
// point at earlier choices, modes don't conflict. Each problem becomes a zod issue, which the
// generation pipeline feeds back to the model for its one repair attempt.
import { queryIssues } from "./compose-query-engine";
import { ENTRY_ITEM_ID, JOIN_ITEM_ID, TEXT_MAX_WORDS_LIMIT, type ComposeInput, type ComposeView, type InputKind, type ViewKind } from "./compose-atoms-schema";

/** Which input kinds each view can read. `null` in the list = the view may have no source. */
export const VIEW_SOURCES: Record<ViewKind, ReadonlyArray<InputKind | null>> = {
  bars: ["choice", "slot", "rating", "person", "date", "datetime"],
  stat: ["number", "rating", null],
  table: [null],
  leaderboard: ["number", "rating"],
  cloud: ["text"],
  groups: ["choice", "slot", "person", "date", "datetime"],
  split: ["number"],
  /** source = quantity input (null → 1 per order); prices come from priced choice options */
  orders: ["number", null],
  /** teams are drawn from the roster, not from an input */
  teams: [null],
  /** reads what its query names */
  summary: [null],
  /** entries (text) everyone can like, most liked first */
  board: ["text", "photo"],
  /** a live message feed over a text input (entries "many") */
  chat: ["text"],
  /** one dot per answer of a place input */
  map: ["place"],
  /** ranked ballots → Borda points per option */
  ranking: ["rank"],
  /** buzzer rounds (buzz inputs, one per step): press order of the current round + rounds won */
  fastest: [null],
  /** source = the amount of each expense (entries "many"); payer = whoever logged it; an optional multi person input = who shares it */
  settle: ["number"],
};

interface WiringTarget {
  inputs: ComposeInput[];
  views: ComposeView[];
  entries?: "one" | "many";
  flow?: "open" | "steps";
}
type Issue = { path: (string | number)[]; message: string };

/** A block whose participants must be listed by name (people picker, team draw, chat authors, or an expense split among everyone). */
export const needsRoster = (b: { inputs: ComposeInput[]; views: ComposeView[] }) =>
  b.inputs.some((i) => i.kind === "person") || b.views.some((v) => v.kind === "teams" || v.kind === "chat" || v.kind === "settle");

function inputIssues(inputs: ComposeInput[], flow: "open" | "steps" | undefined): Issue[] {
  const issues: Issue[] = [];
  const seen = new Map<string, ComposeInput>();
  inputs.forEach((input, i) => {
    const at = (field: string) => ["inputs", i, field];
    if (seen.has(input.id)) issues.push({ path: at("id"), message: `duplicate input id "${input.id}"` });
    // Input ids double as itemIds in steps flow; they must not look like a check-in or a list entry.
    if (input.id === JOIN_ITEM_ID || ENTRY_ITEM_ID.test(input.id)) issues.push({ path: at("id"), message: `input id "${input.id}" is reserved` });
    const needsOptions = input.kind === "choice" || input.kind === "slot" || input.kind === "rank";
    if (needsOptions && !input.options) issues.push({ path: at("options"), message: `${input.kind} input needs options` });
    if (input.options && new Set(input.options.map((o) => o.id)).size !== input.options.length) issues.push({ path: at("options"), message: "duplicate option id" });
    if (input.kind === "rating" && input.max !== null && (!Number.isInteger(input.max) || input.max < 3 || input.max > 10)) {
      issues.push({ path: at("max"), message: "rating max must be an integer 3–10" });
    }
    if (input.kind === "text" && input.max !== null && (!Number.isInteger(input.max) || input.max < 1 || input.max > TEXT_MAX_WORDS_LIMIT)) {
      issues.push({ path: at("max"), message: `text max (words) must be an integer 1–${TEXT_MAX_WORDS_LIMIT}` });
    }
    if (input.kind === "rank" && input.max !== null && (!Number.isInteger(input.max) || input.max < 1 || input.max > (input.options?.length ?? 0))) {
      issues.push({ path: at("max"), message: "rank max (how many to rank) must be an integer from 1 to the number of options" });
    }
    if (input.kind === "number" && input.min !== null && input.max !== null && input.min > input.max) issues.push({ path: at("min"), message: "min > max" });
    if (input.showIf) {
      const target = seen.get(input.showIf.input);
      if (!target || (target.kind !== "choice" && target.kind !== "slot")) {
        issues.push({ path: at("showIf"), message: "showIf.input must be an earlier choice/slot input" });
      } else if (!target.options?.some((o) => o.id === input.showIf!.equals)) {
        issues.push({ path: at("showIf"), message: `showIf.equals must be an option id of "${target.id}"` });
      }
      if (flow === "steps") issues.push({ path: at("showIf"), message: "showIf is not supported in steps flow" });
    }
    if (input.kind === "buzz" && flow !== "steps") issues.push({ path: at("kind"), message: "buzz needs flow \"steps\": each buzz input is one round the host opens" });
    if (input.timeLimitSec !== null && flow !== "steps") issues.push({ path: at("timeLimitSec"), message: "timeLimitSec needs flow \"steps\"" });
    seen.set(input.id, input);
  });
  return issues;
}

function viewIssues(inputs: ComposeInput[], views: ComposeView[], flow: "open" | "steps" | undefined): Issue[] {
  const issues: Issue[] = [];
  const byId = new Map(inputs.map((input) => [input.id, input]));
  const viewIds = new Set<string>();
  views.forEach((view, i) => {
    const at = (field: string) => ["views", i, field];
    if (viewIds.has(view.id)) issues.push({ path: at("id"), message: `duplicate view id "${view.id}"` });
    viewIds.add(view.id);
    if (view.kind === "teams" && view.teams === null) issues.push({ path: at("teams"), message: "teams view needs teams (2–20)" });
    if (view.kind === "fastest" && !inputs.some((i) => i.kind === "buzz")) issues.push({ path: at("kind"), message: "fastest view needs buzz inputs (one per round)" });
    if (view.kind === "board" && flow === "steps") issues.push({ path: at("kind"), message: "board needs flow \"open\" (entries are liked while the app runs)" });
    if (view.visibleTo === "after_step" && flow !== "steps") issues.push({ path: at("visibleTo"), message: "after_step needs flow \"steps\"" });
    if (view.kind === "summary") {
      if (!view.query) issues.push({ path: at("query"), message: "summary view needs a query" });
      else for (const message of queryIssues(view.query, inputs)) issues.push({ path: at("query"), message });
    } else if (view.query) issues.push({ path: at("query"), message: "only a summary view has a query" });
    const allowed = VIEW_SOURCES[view.kind];
    if (view.source === null) {
      const countOnly = view.kind === "stat" ? view.op === "count" : true;
      if (!allowed.includes(null) || !countOnly) issues.push({ path: at("source"), message: `${view.kind} view needs a source input` });
      return;
    }
    const source = byId.get(view.source);
    if (!source) issues.push({ path: at("source"), message: `unknown source input "${view.source}"` });
    else if (!allowed.includes(source.kind) && !(view.kind === "stat" && view.op === "count")) {
      issues.push({ path: at("source"), message: `${view.kind} view cannot read a ${source.kind} input` });
    }
    if (view.kind === "stat" && !view.op) issues.push({ path: at("op"), message: "stat view needs op" });
  });
  return issues;
}

/** Every wiring problem as a human-readable message. */
export function composeWiringIssues(block: WiringTarget): Issue[] {
  const issues = [...inputIssues(block.inputs, block.flow), ...viewIssues(block.inputs, block.views, block.flow)];
  if (block.entries === "many" && block.flow === "steps") issues.push({ path: ["entries"], message: "entries \"many\" can't be combined with flow \"steps\"" });
  block.views.forEach((view, i) => {
    if (view.kind === "chat" && block.entries !== "many") issues.push({ path: ["views", i, "kind"], message: 'chat view needs entries "many" (every message is its own entry)' });
  });
  block.views.forEach((view, i) => {
    if (view.kind === "settle" && block.entries !== "many") issues.push({ path: ["views", i, "kind"], message: 'settle view needs entries "many" (every expense is its own entry; its payer is whoever logged it)' });
  });
  if (block.flow === "steps" && block.inputs.length === 0) issues.push({ path: ["flow"], message: "steps flow needs inputs" });
  if (block.inputs.length === 0 && !block.views.some((v) => v.kind === "teams")) issues.push({ path: ["inputs"], message: "add at least one input (only a teams block may have none)" });
  return issues;
}
