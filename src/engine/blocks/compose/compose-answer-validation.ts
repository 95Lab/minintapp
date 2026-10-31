// Server-side checks for one compose submission. Which record it is comes from itemId:
//   ""          one editable record per person (entries "one", flow "open")
//   "e-…"       one record in a list (entries "many"); `removed: true` deletes it
//   <input id>  the answer to one step (flow "steps"; only while the host has that step open)
//   "_join"     roster check-in for blocks with a people picker or teams
// Values are then checked per atom, honouring showIf (hidden inputs must stay empty).
import type { AnswerValidationError, AppRuntime } from "../block-definition-types";
import { PAID_ITEM_ID, PHOTO_ID, LIKE_ITEM_ID, DATE_VALUE, DATETIME_VALUE, DEFAULT_RATING_MAX, ENTRY_ITEM_ID, JOIN_ITEM_ID, ROSTER_ID, TEXT_MAX_LENGTH, type ComposeInput, type ComposePayload, type ComposeValue, type ComposeView } from "./compose-atoms-schema";
import { parseLatLng } from "@/engine/geo/web-mercator-tiles";
import { composeState, stepAcceptsAnswer } from "./compose-runtime-state";
import { needsRoster } from "./compose-wiring-rules";
import { isBlockedAnswer, LINK_LIKE, wordCount } from "./text-answer-filters";

interface Block {
  id: string;
  entries?: "one" | "many";
  flow?: "open" | "steps";
  inputs: ComposeInput[];
  views: ComposeView[];
}

const isEmpty = (v: ComposeValue | undefined) => v === undefined || v === "" || (Array.isArray(v) && v.length === 0);

function validDate(v: string, withTime: boolean): boolean {
  if (!(withTime ? DATETIME_VALUE : DATE_VALUE).test(v)) return false;
  const d = new Date(withTime ? `${v}:00Z` : `${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,v.length) === v;
}

function validateValue(input: ComposeInput, v: ComposeValue): boolean {
  const pickList = (ok: (id: string) => boolean) => {
    const ids = input.multi ? v : [v];
    return Array.isArray(ids) && ids.length > 0 && new Set(ids).size === ids.length && ids.every((id) => typeof id === "string" && ok(id));
  };
  switch (input.kind) {
    case "text":
      return typeof v === "string" && v.length <= TEXT_MAX_LENGTH && !LINK_LIKE.test(v) && !isBlockedAnswer(v) && (input.max === null || wordCount(v) <= input.max);
    case "number":
      return typeof v === "number" && (input.min === null || v >= input.min) && (input.max === null || v <= input.max) && Math.abs(v) <= 1e12;
    case "rating":
      return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= (input.max ?? DEFAULT_RATING_MAX);
    case "slot":
      return typeof v === "string" && !!input.options?.some((o) => o.id === v);
    case "choice":
      return pickList((id) => !!input.options?.some((o) => o.id === id));
    // Roster membership is checked when results are computed (unknown ids are ignored there).
    case "person":
      return pickList((id) => ROSTER_ID.test(id));
    // An uploaded photo's id (ownership is checked when results are computed).
    case "photo":
      return typeof v === "string" && PHOTO_ID.test(v);
    // "lat,lng" at ≤ 3 decimals (~100 m): finer precision is refused, not trimmed, so it never gets stored.
    case "place":
      return parseLatLng(v) !== null;
    // A buzzer press: always 1 (who was first comes from the server's receive time).
    case "buzz":
      return v === 1;
    // An ordered list of distinct options: the first is the favourite; at most `max` (top N) of them.
    case "rank":
      return Array.isArray(v) && v.length > 0 && v.length <= (input.max ?? input.options?.length ?? 0) && new Set(v).size === v.length && v.every((id) => !!input.options?.some((o) => o.id === id));
    case "date":
      return typeof v === "string" && validDate(v, false);
    case "datetime":
      return typeof v === "string" && validDate(v, true);
  }
}

/** Is the input visible for these values? (showIf on an earlier choice/slot) */
export function inputShown(input: ComposeInput, values: Record<string, ComposeValue>): boolean {
  if (!input.showIf) return true;
  const v = values[input.showIf.input];
  return Array.isArray(v) ? v.includes(input.showIf.equals) : v === input.showIf.equals;
}

function validateValues(inputs: ComposeInput[], values: Record<string, ComposeValue>): AnswerValidationError | null {
  const known = new Set(inputs.map((i) => i.id));
  if (Object.keys(values).some((k) => !known.has(k))) return "bad_payload";
  const shown = new Set<string>();
  for (const input of inputs) {
    const v = values[input.id];
    if (input.showIf && !shown.has(input.showIf.input) || !inputShown(input, values)) {
      if (!isEmpty(v)) return "bad_payload";
      continue;
    }
    shown.add(input.id);
    if (isEmpty(v)) {
      if (input.required) return "bad_payload";
      continue;
    }
    if (!validateValue(input, v!)) return typeof v === "string" && v.length > TEXT_MAX_LENGTH ? "too_long" : "bad_payload";
  }
  return null;
}

export function validateComposeAnswer(block: Block, p: ComposePayload, ctx: { itemId: string; runtime: AppRuntime }): AnswerValidationError | null {
  const noValues = Object.keys(p.values).length === 0;
  // A like (or unlike) on a board entry: no values, only on blocks that have a board.
  if (p.like || LIKE_ITEM_ID.test(ctx.itemId)) {
    const hasBoard = block.views.some((v) => v.kind === "board");
    return hasBoard && block.flow !== "steps" && LIKE_ITEM_ID.test(ctx.itemId) && noValues && !p.join && !p.paid && (p.like === true) !== (p.removed === true) ? null : "bad_payload";
  }
  // "I've transferred" (or withdrawing it) on a settle view: no values, one per person.
  if (p.paid || ctx.itemId === PAID_ITEM_ID) {
    const hasSettle = block.views.some((v) => v.kind === "settle");
    return hasSettle && block.flow !== "steps" && ctx.itemId === PAID_ITEM_ID && noValues && !p.join && (p.paid !== undefined) !== (p.removed === true) ? null : "bad_payload";
  }
  if (p.join) return ctx.itemId === JOIN_ITEM_ID && noValues && !p.removed && needsRoster(block) ? null : "bad_payload";
  if (ctx.itemId === JOIN_ITEM_ID) return "bad_payload";

  if (block.flow === "steps") {
    // Buzzer presses name the current game: "<input id>~<epoch>" (restart starts a new game).
    const [inputId, epoch] = ctx.itemId.split("~");
    const input = block.inputs.find((i) => i.id === inputId);
    if (!input || p.removed) return "bad_payload";
    if ((input.kind === "buzz") !== (epoch !== undefined)) return "bad_payload";
    if (input.kind === "buzz" && epoch !== String(composeState(ctx.runtime, block.id).epoch ?? 0)) return "question_closed";
    if (stepAcceptsAnswer(block.inputs, composeState(ctx.runtime, block.id), input.id) === "closed") return "question_closed";
    return validateValues([{ ...input, showIf: null }], p.values);
  }

  if (block.entries === "many") {
    if (!ENTRY_ITEM_ID.test(ctx.itemId)) return "bad_payload";
    if (p.removed) return noValues ? null : "bad_payload";
  } else if (ctx.itemId !== "" || p.removed) {
    return "bad_payload";
  }
  return validateValues(block.inputs, p.values);
}
