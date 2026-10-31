// Turns a compose block's stored answers into what one viewer may see: the roster (people picker,
// teams), records (list entries capped per person; steps merged per person), slot seats, the open
// step, and each view filtered by `visibleTo`.
import type { AnswerRow, AppRuntime, ResultsContext } from "../block-definition-types";
import { resultLabels } from "@/engine/i18n/result-labels-vi-en";
import { rosterIdOf, JOIN_ITEM_ID, MAX_ENTRIES_PER_PERSON, PAID_ITEM_ID, type ComposeInput, type ComposePayload, type ComposeView } from "./compose-atoms-schema";
import { allocateSlots, type ComposeRow, type RosterEntry } from "./compose-aggregation-helpers";
import { approvedPhotos, composeState, receivedPayments, rosterFrom, stepDeadline } from "./compose-runtime-state";
import { computeComposeView, type ComposeViewResult } from "./compose-view-aggregators";
import { needsRoster } from "./compose-wiring-rules";

export interface ComposeResults {
  type: "compose";
  blockId: string;
  /** records counted by the views (list entries count one by one) */
  submissions: number;
  views: ComposeViewResult[];
  /** slot input id → option id → seats taken (public: lets participants see what's full) */
  seats: Record<string, Record<string, number>>;
  /** slot inputs where one of the viewer's records is on the waitlist */
  myWaitlist: string[];
  /** people picker / teams blocks only: who is here (public id + name) */
  roster: RosterEntry[] | null;
  /** whether the viewer already checked in / answered in this block */
  joined: boolean;
  /** steps flow only; `remainingMs` is measured on the server so phones with a wrong clock count down correctly */
  step: { current: string | null; deadline: number | null; remainingMs: number | null; done: string[]; epoch: number } | null;
}

interface Block {
  id: string;
  title: string;
  entries?: "one" | "many";
  flow?: "open" | "steps";
  inputs: ComposeInput[];
  views: ComposeView[];
}


function stepInfo(inputs: ComposeInput[], state: ReturnType<typeof composeState>): NonNullable<ComposeResults["step"]> {
  const deadline = stepDeadline(inputs, state);
  return { current: state.step.current, deadline, remainingMs: deadline === null ? null : Math.max(0, deadline - Date.now()), done: state.step.done, epoch: state.epoch ?? 0 };
}

/** Display name per participant; two people with the same name become "Lan", "Lan (2)". */
function namesByParticipant(roster: Array<{ hash: string; name: string }>, anonymous: string): Map<string, string> {
  const seen = new Map<string, number>();
  const out = new Map<string, string>();
  roster.forEach((r, i) => {
    const base = r.name || `${anonymous} ${i + 1}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    out.set(r.hash, n === 1 ? base : `${base} (${n})`);
  });
  return out;
}

function buildRows(block: Block, answers: AnswerRow<ComposePayload>[], names: Map<string, string>, anonymous: string, runtime: AppRuntime): ComposeRow[] {
  const data = answers.filter((a) => a.itemId !== JOIN_ITEM_ID && !a.payload.join && !a.payload.removed && !a.payload.like && !a.payload.paid);
  if (block.flow === "steps") {
    // One row per person with every step they answered.
    const merged = new Map<string, ComposeRow>();
    const epoch = String(composeState(runtime, block.id).epoch ?? 0);
    for (const a of data) {
      // A buzzer press from an earlier game (before a restart) doesn't count.
      const [inputId, pressEpoch] = a.itemId.split("~");
      if (pressEpoch !== undefined && pressEpoch !== epoch) continue;
      const row = merged.get(a.participantHash) ?? { key: a.participantHash, participantHash: a.participantHash, name: names.get(a.participantHash) ?? anonymous, values: {}, at: {} };
      row.values = { ...row.values, ...a.payload.values };
      // A record keeps its first receive time when it is re-sent: a buzzer press can't be "moved earlier".
      row.at = { ...row.at, [inputId]: a.createdAt };
      merged.set(a.participantHash, row);
    }
    return [...merged.values()];
  }
  const perPerson = new Map<string, number>();
  return data.flatMap((a) => {
    const n = (perPerson.get(a.participantHash) ?? 0) + 1;
    perPerson.set(a.participantHash, n);
    if (n > MAX_ENTRIES_PER_PERSON) return [];
    return [{ key: `${a.participantHash}:${a.itemId}`, participantHash: a.participantHash, name: names.get(a.participantHash) ?? anonymous, values: a.payload.values, itemId: a.itemId, createdAt: a.createdAt }];
  });
}

export function computeComposeResults(block: Block, answers: AnswerRow<ComposePayload>[], { appStatus, runtime, viewer, locale, photoUrl }: ResultsContext): ComposeResults {
  const labels = resultLabels(locale);
  const sorted = [...answers].sort((a, b) => a.createdAt - b.createdAt);
  const people = rosterFrom(sorted);
  const names = namesByParticipant(people, labels.anonymous);
  const roster = people.map((p) => ({ id: p.id, name: names.get(p.hash) ?? labels.anonymous }));
  const rows = buildRows(block, sorted, names, labels.anonymous, runtime);
  const state = composeState(runtime, block.id);

  const seats: ComposeResults["seats"] = {};
  const myWaitlist: string[] = [];
  for (const input of block.inputs.filter((i) => i.kind === "slot")) {
    const seated = allocateSlots(input, rows);
    seats[input.id] = {};
    for (const row of rows) {
      const choice = row.values[input.id];
      if (typeof choice === "string" && seated.get(row.key)) seats[input.id][choice] = (seats[input.id][choice] ?? 0) + 1;
    }
    if (rows.some((r) => r.participantHash === viewer.participantHash && seated.get(r.key) === false)) myWaitlist.push(input.id);
  }

  const submitted = !!viewer.participantHash && rows.some((r) => r.participantHash === viewer.participantHash);
  const closed = appStatus !== "active";
  const stepDone = (view: ComposeView) => (view.source ? state.step.done.includes(view.source) : block.inputs.every((i) => state.step.done.includes(i.id)));
  // Board likes: entry id → who liked it (roster ids). A like on one's own entry doesn't count.
  const likes = new Map<string, Set<string>>();
  for (const a of sorted) {
    if (!a.payload.like || a.payload.removed) continue;
    const entryId = a.itemId.slice(2);
    if (entryId.startsWith(rosterIdOf(a.participantHash))) continue;
    likes.set(entryId, (likes.get(entryId) ?? new Set()).add(rosterIdOf(a.participantHash)));
  }
  const viewerId = viewer.participantHash ? rosterIdOf(viewer.participantHash) : null;
  // Settle view: "I've transferred" marks (a withdrawn mark is a deleted record, so only live ones are here).
  const paidMarks = new Map(sorted.flatMap((a) => (a.itemId === PAID_ITEM_ID && a.payload.paid && !a.payload.removed ? [[rosterIdOf(a.participantHash), a.payload.paid] as [string, number]] : [])));
  const ctx = { inputs: block.inputs, rows, isHost: viewer.isHost, roster, teams: state.teams, labels, likes, viewerId, step: state.step, approved: approvedPhotos(runtime, block.id), photoUrl, paidMarks, received: receivedPayments(runtime, block.id) };
  // A block without views still gives the host every record.
  const declared: ComposeView[] = block.views.length ? block.views : [{ id: "_all", kind: "table", title: null, source: null, op: null, topN: null, teams: null, query: null, visibleTo: "host" }];
  const views = declared.flatMap((view): ComposeViewResult[] => {
    const pending = (): ComposeViewResult[] => [
      { kind: "pending", id: view.id, title: view.title ?? block.inputs.find((i) => i.id === view.source)?.label ?? "", reason: view.visibleTo === "after_step" ? "step" : "close" },
    ];
    if (viewer.isHost || view.visibleTo === "everyone") return [computeComposeView(view, ctx)];
    if (view.visibleTo === "host") return [];
    if (view.visibleTo === "after_submit") return submitted ? [computeComposeView(view, ctx)] : [];
    if (view.visibleTo === "after_step" && (closed || stepDone(view))) return [computeComposeView(view, ctx)];
    if (view.visibleTo === "after_close" && closed) return [computeComposeView(view, ctx)];
    return pending();
  });

  return {
    type: "compose",
    blockId: block.id,
    submissions: rows.length,
    views,
    seats,
    myWaitlist,
    roster: needsRoster(block) ? roster : null,
    joined: !!viewer.participantHash && people.some((p) => p.hash === viewer.participantHash),
    step: block.flow === "steps" ? stepInfo(block.inputs, state) : null,
  };
}

/** Plain-text results for a remix prompt; bars first, most votes first ("quiz about the winning topic"). */
export function summarizeComposeResults(block: Block, r: ComposeResults | null): string {
  if (!r) return "";
  const bars = r.views.flatMap((v) => (v.kind === "bars" ? [`${v.title}: ${[...v.bars].sort((a, b) => b.value - a.value).map((b) => `${b.label} ${b.value}`).join(", ")}`] : []));
  const parts = r.views.flatMap((v) => {
    if (v.kind === "orders") return [`${v.title}: ${v.count} đơn${v.priced ? `, tổng ${v.total}đ` : ""}`];
    if (v.kind === "stat") return [`${v.title} (${v.op}): ${v.value ?? "-"}`];
    if (v.kind === "split") return [`${v.title}: tổng ${v.total}, mỗi người ${v.share}`];
    if (v.kind === "settle") return [`${v.title}: tổng ${v.total}, ${v.transfers.length} khoản cần chuyển`];
    if (v.kind === "cloud") return [`${v.title}: ${v.words.slice(0, 8).map((w) => w.text).join(", ")}`];
    if (v.kind === "fastest") return [`${v.title}: ${v.wins.slice(0, 5).map((w) => `${w.name} ${w.rounds}`).join(", ")}`];
    if (v.kind === "ranking") return [`${v.title}: ${v.items.slice(0, 5).map((it) => `${it.label} ${it.points}`).join(", ")}`];
    if (v.kind === "board") return [`${v.title}: ${v.items.slice(0, 5).map((it) => `"${it.text}" (${it.likes} ♥)`).join(", ")}`];
    if (v.kind === "leaderboard") return [`${v.title}: ${v.rows.slice(0, 5).map((row) => `${row.name} ${row.value}`).join(", ")}`];
    if (v.kind === "teams" && v.teams) return [`${v.title}: ${v.teams.map((t) => `${t.name} (${t.members.join(", ")})`).join("; ")}`];
    return [];
  });
  return [...bars, ...parts, `${block.title}: ${r.submissions} lượt gửi`].join("; ");
}
