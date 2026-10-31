// Host-driven state of a compose block, kept in runtime.blocks[blockId]: which step (input) is open
// and since when, which steps are done, and the current team draw. Host actions change it; answer
// validation and results read it. Randomness comes from the server (crypto) via HostActionContext.
import { blockState, withBlockState, type AppRuntime, type HostActionContext, type HostActionResult } from "../block-definition-types";
import { PHOTO_ID, ROSTER_ID, rosterIdOf, type ComposeInput, type ComposePayload, type ComposeView } from "./compose-atoms-schema";

export interface ComposeState {
  step: { current: string | null; openedAt: number | null; done: string[] };
  /** roster ids per team, from the last shuffle */
  teams: string[][] | null;
  /** steps flow: bumped by `restart`, so a new game's buzzer rounds don't reuse old presses */
  epoch?: number;
}

/** Runtime key of one photo's approval. One key per photo: two quick approve / hide taps can't undo each other. */
const approvalKey = (photoId: string) => `ph:${photoId}`;

/** Photo ids the host approved (keys `ph:<id>` = true in the block's runtime slot). */
export function approvedPhotos(runtime: AppRuntime, blockId: string): Set<string> {
  const slot = blockState<Record<string, unknown>>(runtime, blockId, {});
  return new Set(Object.entries(slot).flatMap(([k, v]) => (k.startsWith("ph:") && v === true ? [k.slice(3)] : [])));
}

/** Runtime key of the host's "payment received" mark for one person (keys `rc:<roster id>` = whole đồng received so far). */
const receivedKey = (rosterId: string) => `rc:${rosterId}`;
const MAX_RECEIVED = 1e12;

/** Roster id → total amount the host confirmed as received (people with nothing confirmed are absent). */
export function receivedPayments(runtime: AppRuntime, blockId: string): Map<string, number> {
  const slot = blockState<Record<string, unknown>>(runtime, blockId, {});
  return new Map(Object.entries(slot).flatMap(([k, v]): Array<[string, number]> => (k.startsWith("rc:") && typeof v === "number" && v > 0 ? [[k.slice(3), v]] : [])));
}

const EMPTY: ComposeState = { step: { current: null, openedAt: null, done: [] }, teams: null };
/** Grace period for answers sent right at the buzzer (network latency). */
const DEADLINE_GRACE_MS = 2000;

export const composeState = (runtime: AppRuntime, blockId: string): ComposeState => ({ ...EMPTY, ...blockState<Partial<ComposeState>>(runtime, blockId, {}) });

/** Deadline (ms) of the open step, or null when it isn't timed. */
export function stepDeadline(inputs: ComposeInput[], state: ComposeState): number | null {
  const input = inputs.find((i) => i.id === state.step.current);
  return input?.timeLimitSec && state.step.openedAt ? state.step.openedAt + input.timeLimitSec * 1000 : null;
}

/** itemId of a buzzer press in the current game ("<input id>~<epoch>"); other steps use the input id. */
export const buzzItemId = (inputId: string, epoch: number) => `${inputId}~${epoch}`;

/** Whether an answer to `inputId` is accepted right now in steps flow. */
export function stepAcceptsAnswer(inputs: ComposeInput[], state: ComposeState, inputId: string, now = Date.now()): "ok" | "closed" {
  if (state.step.current !== inputId || state.step.done.includes(inputId)) return "closed";
  const deadline = stepDeadline(inputs, state);
  return deadline !== null && now > deadline + DEADLINE_GRACE_MS ? "closed" : "ok";
}

/** Distinct participants who checked in or answered, in arrival order. */
export function rosterFrom(answers: Array<{ participantHash: string; displayName: string | null; createdAt: number }>): Array<{ id: string; hash: string; name: string }> {
  const byHash = new Map<string, { id: string; hash: string; name: string; at: number }>();
  for (const a of answers) {
    const prev = byHash.get(a.participantHash);
    if (!prev || a.createdAt < prev.at) byHash.set(a.participantHash, { id: rosterIdOf(a.participantHash), hash: a.participantHash, name: a.displayName || prev?.name || "", at: a.createdAt });
  }
  return [...byHash.values()].sort((a, b) => a.at - b.at).map(({ id, hash, name }) => ({ id, hash, name }));
}

type Ctx = HostActionContext<ComposePayload>;
type Block = { id: string; inputs: ComposeInput[]; views: ComposeView[] };

/** Host actions of a compose block (steps: next / close / restart; teams: shuffle). */
export const composeHostActions: Record<string, (block: Block, runtime: AppRuntime, ctx: Ctx) => HostActionResult> = {
  /** Closes the open step (if any) and opens the next one not yet done. */
  next(block, runtime) {
    const state = composeState(runtime, block.id);
    const done = state.step.current && !state.step.done.includes(state.step.current) ? [...state.step.done, state.step.current] : state.step.done;
    const nextInput = block.inputs.find((i) => !done.includes(i.id));
    if (!nextInput) return { ok: false, error: "no_more_steps" };
    return { ok: true, runtime: withBlockState(runtime, block.id, { ...state, step: { current: nextInput.id, openedAt: Date.now(), done } }) };
  },
  close(block, runtime) {
    const state = composeState(runtime, block.id);
    if (!state.step.current) return { ok: false, error: "no_open_step" };
    const done = state.step.done.includes(state.step.current) ? state.step.done : [...state.step.done, state.step.current];
    return { ok: true, runtime: withBlockState(runtime, block.id, { ...state, step: { current: null, openedAt: null, done } }) };
  },
  restart(block, runtime) {
    const state = composeState(runtime, block.id);
    return { ok: true, runtime: withBlockState(runtime, block.id, { ...state, step: EMPTY.step, epoch: (state.epoch ?? 0) + 1 }) };
  },
  /** Shows (on: true) or hides a participant's photo for everyone; until then only its author and the host see it. */
  approve(block, runtime, ctx) {
    const photoId = ctx.args.photoId;
    if (typeof photoId !== "string" || !PHOTO_ID.test(photoId) || !block.inputs.some((i) => i.kind === "photo")) return { ok: false, error: "bad_action" };
    const slot = blockState<Record<string, unknown>>(runtime, block.id, {});
    return { ok: true, runtime: withBlockState(runtime, block.id, { ...slot, [approvalKey(photoId)]: ctx.args.on !== false }) };
  },
  /**
   * Sets how much of a person's debt the host has received, on a block with a settle view (`amount` in whole
   * đồng; 0 clears it). Only people on the block's roster can be named.
   */
  confirm_paid(block, runtime, ctx) {
    const { rosterId, amount } = ctx.args;
    if (typeof rosterId !== "string" || !ROSTER_ID.test(rosterId) || !block.views.some((v) => v.kind === "settle")) return { ok: false, error: "bad_action" };
    if (typeof amount !== "number" || !Number.isInteger(amount) || amount < 0 || amount > MAX_RECEIVED) return { ok: false, error: "bad_action" };
    if (!rosterFrom(ctx.answers).some((p) => p.id === rosterId)) return { ok: false, error: "bad_action" };
    const slot = blockState<Record<string, unknown>>(runtime, block.id, {});
    return { ok: true, runtime: withBlockState(runtime, block.id, { ...slot, [receivedKey(rosterId)]: amount }) };
  },
  /** Deals the roster into N teams uniformly at random (Fisher–Yates with server randomness). */
  shuffle(block, runtime, ctx) {
    const view = block.views.find((v) => v.kind === "teams" && (ctx.args.viewId === undefined || v.id === ctx.args.viewId));
    if (!view?.teams) return { ok: false, error: "no_teams_view" };
    // Same roster the results show: everyone who checked in or answered in this block.
    const ids = rosterFrom(ctx.answers).map((r) => r.id);
    if (ids.length < 2) return { ok: false, error: "need_two_people" };
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(ctx.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    const count = Math.min(view.teams, ids.length);
    const teams: string[][] = Array.from({ length: count }, () => []);
    ids.forEach((id, i) => teams[i % count].push(id));
    return { ok: true, runtime: withBlockState(runtime, block.id, { ...composeState(runtime, block.id), teams }) };
  },
};
