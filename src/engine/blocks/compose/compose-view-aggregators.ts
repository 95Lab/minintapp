// Computes what each compose view shows. Numbers come from queries (compose-view-queries.ts →
// compose-query-engine.ts); this file only picks the query for a view kind and shapes the result.
// Everything runs on the server over the stored answers, so participants can't fake totals, seats,
// balances or team draws.
import { parseLatLng } from "@/engine/geo/web-mercator-tiles";
import { wordCloud } from "./text-answer-filters";
import type { ResultLabels } from "@/engine/i18n/result-labels-vi-en";
import { entryIdOf, type ComposeInput, type ComposeView, type StatOp } from "./compose-atoms-schema";
import { allocateSlots, formatComposeValue, hasPrices, optionsOf, round2, selectedIds, settleTransfers, type ComposeRow, type RosterEntry } from "./compose-aggregation-helpers";
import { runQuery } from "./compose-query-engine";
import { computeSettleView, type SettleResult } from "./compose-settle-view";
import { barsQuery, leaderboardQuery, orderLineTotal, ordersQuery, splitQuery, statQuery } from "./compose-view-queries";

export { allocateSlots, formatComposeValue, hasPrices, orderLineTotal, settleTransfers, type ComposeRow, type RosterEntry };

const numberOr = (v: unknown, fallback: number) => (typeof v === "number" ? v : fallback);

export type ComposeViewResult =
  | { kind: "bars"; id: string; title: string; total: number; bars: Array<{ id: string; label: string; value: number }> }
  | { kind: "stat"; id: string; title: string; op: StatOp; value: number | null; unit: string | null }
  /** `keyColumn`: header of the first column (default "Name"); null → no key column (one-row summary) */
  | { kind: "table"; id: string; title: string; columns: string[]; rows: Array<Array<string | number>>; keyColumn?: string | null }
  | { kind: "leaderboard"; id: string; title: string; unit: string | null; rows: Array<{ name: string; value: number }> }
  | { kind: "cloud"; id: string; title: string; words: Array<{ text: string; count: number }> }
  | { kind: "groups"; id: string; title: string; groups: Array<{ id: string; label: string; capacity: number | null; names: string[]; waitlist: string[] }> }
  | {
      kind: "split";
      id: string;
      title: string;
      unit: string | null;
      total: number;
      share: number;
      people: Array<{ name: string; paid: number; balance: number }>;
      transfers: Array<{ from: string; to: string; amount: number }>;
    }
  | {
      kind: "orders";
      id: string;
      title: string;
      count: number;
      totalQuantity: number;
      total: number;
      priced: boolean;
      columns: string[];
      /** host only: participants get count + total, never other people's orders */
      rows: Array<{ name: string; cells: string[]; lineTotal: number }>;
    }
  /** teams: null until the host shuffles; `waiting` = people who joined after the draw */
  | { kind: "teams"; id: string; title: string; joined: number; teams: Array<{ name: string; members: string[] }> | null; waiting: string[] }
  /** buzzer: press order of the current (or last) round with time after the first press, and rounds won per person */
  | { kind: "fastest"; id: string; title: string; round: { id: string; label: string } | null; order: Array<{ name: string; afterMs: number }>; wins: Array<{ name: string; rounds: number }> }
  /** ranked ballots: Borda points over N slots (top N, or all options): 1st = N points, 2nd = N − 1 … unranked = 0; most points first */
  | { kind: "ranking"; id: string; title: string; voters: number; items: Array<{ id: string; label: string; points: number; first: number }> }
  /** entries everyone can like, most liked first; `mine` = the viewer wrote it, `liked` = the viewer liked it */
  | {
      kind: "board";
      id: string;
      title: string;
      /** photo boards: `photo` = signed URL, `photoId` for the host's approve / hide, `approved` = visible to everyone */
      items: Array<{ id: string; text: string; name: string; likes: number; mine: boolean; liked: boolean; photo?: string; photoId?: string; approved?: boolean }>;
    }
  /** the last messages of a text input, oldest first; `mine` = the viewer wrote it, `at` = server time (ms) */
  | { kind: "chat"; id: string; title: string; messages: Array<{ id: string; author: string; text: string; at: number; mine: boolean }> }
  /** one dot per place answer (newest MAP_MAX_POINTS); `name` = who shared it, `mine` = the viewer's own dot */
  | { kind: "map"; id: string; title: string; points: Array<{ lat: number; lng: number; name: string | null; mine: boolean }> }
  /** who owes whom from an expense log: balances per person and the fewest transfers, with the viewer's own flagged and the paid / received marks */
  | ({ kind: "settle"; id: string; title: string } & SettleResult)
  /** hidden from participants until the app (`close`) or the source step (`step`) closes */
  | { kind: "pending"; id: string; title: string; reason: "close" | "step" };

export interface ViewContext {
  inputs: ComposeInput[];
  /** records in submission order (list entries count separately; steps are merged per person) */
  rows: ComposeRow[];
  isHost: boolean;
  roster: RosterEntry[];
  /** roster ids per team from the last shuffle */
  teams: string[][] | null;
  /** words written into cells in the app's language (default Vietnamese) */
  labels?: ResultLabels;
  /** board likes: entry id → roster ids of people who liked it */
  likes?: Map<string, Set<string>>;
  /** the viewer's roster id (null for the host screen) */
  viewerId?: string | null;
  /** steps flow: the open step and the closed ones */
  step?: { current: string | null; done: string[] };
  /** settle view: roster id → amount of their "I've transferred" mark / of the payments the host confirmed as received */
  paidMarks?: Map<string, number>;
  received?: Map<string, number>;
  /** photo ids the host approved */
  approved?: Set<string>;
  /** signs a photo URL (server only) */
  photoUrl?: (photoId: string) => string;
}

const TABLE_MAX_ROWS = 200;
const BOARD_MAX_ITEMS = 100;
const CHAT_MAX_MESSAGES = 200;
const MAP_MAX_POINTS = 300;

/** Computes one view. */
export function computeComposeView(view: ComposeView, ctx: ViewContext): ComposeViewResult {
  const { inputs, rows, isHost, roster } = ctx;
  const source = view.source ? inputs.find((i) => i.id === view.source) : undefined;
  // An orders view reads the quantity input; its label ("Số lượng") is not a title.
  const title = view.title ?? (view.kind === "orders" ? "" : (source?.label ?? ""));
  const base = { id: view.id, title };

  switch (view.kind) {
    case "bars": {
      if (!source) return { ...base, kind: "bars", total: 0, bars: [] };
      const options = optionsOf(source, rows, roster);
      // Unknown ids (e.g. a person who is no longer on the roster) don't count as a vote.
      const result = runQuery(barsQuery(source.id, options.map((o) => o.id), source.kind === "rating"), rows, inputs);
      const votes = new Map(result.groups.map((g) => [g.key, numberOr(g.values.votes, 0)]));
      return { ...base, kind: "bars", total: numberOr(result.totals.votes, 0), bars: options.map((o) => ({ id: o.id, label: o.label, value: votes.get(o.id) ?? 0 })) };
    }
    case "stat": {
      const op = view.op ?? "count";
      const value = runQuery(statQuery(op, source?.id ?? null), rows, inputs).totals.value;
      return { ...base, kind: "stat", op, value: typeof value === "number" ? value : null, unit: source?.kind === "number" ? source.unit : null };
    }
    case "table": {
      const seats = new Map(inputs.filter((i) => i.kind === "slot").map((i) => [i.id, allocateSlots(i, rows)]));
      return {
        ...base,
        kind: "table",
        columns: inputs.map((i) => i.label),
        rows: rows.slice(0, TABLE_MAX_ROWS).map((r) => [r.name, ...inputs.map((i) => formatComposeValue(i, r.values[i.id], roster, seats.get(i.id)?.get(r.key) === false, ctx.labels))]),
      };
    }
    case "leaderboard": {
      // Per person: several list entries (e.g. runs) add up by default.
      const scored = source ? runQuery(leaderboardQuery(source.id, view.op ?? "sum", view.topN ?? 10), rows, inputs).groups : [];
      return { ...base, kind: "leaderboard", unit: source?.unit ?? null, rows: scored.map((g) => ({ name: g.name ?? "", value: numberOr(g.values.value, 0) })) };
    }
    case "cloud":
      return { ...base, kind: "cloud", words: source ? wordCloud(rows.map((r) => r.values[source.id]).filter((v): v is string => typeof v === "string")) : [] };
    case "groups": {
      if (!source) return { ...base, kind: "groups", groups: [] };
      const seats = source.kind === "slot" ? allocateSlots(source, rows) : null;
      const groups = optionsOf(source, rows, roster).map((o) => ({ ...o, capacity: source.kind === "slot" ? source.capacity : null, names: [] as string[], waitlist: [] as string[] }));
      for (const row of rows) {
        for (const id of selectedIds(row.values[source.id])) {
          const g = groups.find((x) => x.id === id);
          if (!g) continue;
          if (seats?.get(row.key) === false) g.waitlist.push(row.name);
          else g.names.push(row.name);
        }
      }
      return { ...base, kind: "groups", groups };
    }
    case "orders": {
      const totals = runQuery(ordersQuery(view.source), rows, inputs).totals;
      const shown = isHost
        ? rows.slice(0, TABLE_MAX_ROWS).map((r) => ({ name: r.name, cells: inputs.map((i) => formatComposeValue(i, r.values[i.id], roster, false, ctx.labels)), lineTotal: orderLineTotal(inputs, r.values, view.source).total }))
        : [];
      return {
        ...base,
        kind: "orders",
        count: numberOr(totals.count, 0),
        totalQuantity: numberOr(totals.qty, 0),
        total: numberOr(totals.total, 0),
        priced: hasPrices(inputs),
        columns: inputs.map((i) => i.label),
        rows: shown,
      };
    }
    case "split": {
      // Per person: every expense entry of the same person adds up to what they paid.
      const paid = source ? runQuery(splitQuery(source.id), rows, inputs).groups.map((g) => ({ name: g.name ?? "", paid: numberOr(g.values.paid, 0) })) : [];
      const total = round2(paid.reduce((a, p) => a + p.paid, 0));
      const share = paid.length ? round2(total / paid.length) : 0;
      const people = paid.map((p) => ({ ...p, balance: round2(p.paid - total / paid.length) }));
      return { ...base, kind: "split", unit: source?.unit ?? null, total, share, people, transfers: settleTransfers(people) };
    }
    case "summary": {
      if (!view.query) return { ...base, kind: "table", columns: [], rows: [] };
      const q = view.query;
      const columns = [...q.measures, ...q.derived];
      const groupInput = inputs.find((i) => i.id === q.groupBy);
      const labels = new Map(groupInput ? optionsOf(groupInput, rows, roster).map((o) => [o.id, o.label]) : []);
      const keyColumn = q.groupBy === null ? null : (groupInput?.label ?? undefined);
      const cell = (v: unknown): string | number => (typeof v === "number" ? v : Array.isArray(v) ? v.join(", ") : v === null || v === undefined ? "" : String(v));
      const result = runQuery(q, rows, inputs);
      // Grouped: one row per group. Ungrouped: the grand totals (also when there are no rows yet).
      const tableRows = q.groupBy === null
        ? [columns.map((c) => cell(result.groups[0]?.values[c.key] ?? result.totals[c.key]))]
        : result.groups.map((g) => [g.name ?? labels.get(g.key) ?? g.key, ...columns.map((c) => cell(g.values[c.key]))]);
      return { ...base, kind: "table", keyColumn, columns: columns.map((c) => c.label ?? c.key), rows: tableRows.slice(0, TABLE_MAX_ROWS) };
    }
    case "fastest": {
      const buzzers = inputs.filter((i) => i.kind === "buzz");
      const pressOrder = (inputId: string) =>
        rows
          .filter((r) => r.values[inputId] === 1 && r.at?.[inputId] !== undefined)
          .map((r) => ({ name: r.name, at: r.at![inputId] }))
          .sort((a, b) => a.at - b.at);
      // The round on screen: the open buzz step, else the last closed one.
      const current = buzzers.find((i) => i.id === ctx.step?.current) ?? [...buzzers].reverse().find((i) => ctx.step?.done.includes(i.id)) ?? null;
      const presses = current ? pressOrder(current.id) : [];
      const wins = new Map<string, number>();
      for (const input of buzzers) {
        const first = pressOrder(input.id)[0];
        if (first) wins.set(first.name, (wins.get(first.name) ?? 0) + 1);
      }
      return {
        ...base,
        title: view.title ?? "",
        kind: "fastest",
        round: current ? { id: current.id, label: current.label } : null,
        order: presses.map((p) => ({ name: p.name, afterMs: p.at - presses[0].at })),
        wins: [...wins.entries()].map(([name, rounds]) => ({ name, rounds })).sort((a, b) => b.rounds - a.rounds),
      };
    }
    case "ranking": {
      if (!source) return { ...base, kind: "ranking", voters: 0, items: [] };
      const slots = source.max ?? source.options?.length ?? 0;
      const tally = new Map((source.options ?? []).map((o) => [o.id, { id: o.id, label: o.label, points: 0, first: 0 }]));
      let voters = 0;
      for (const row of rows) {
        const order = selectedIds(row.values[source.id]).filter((id) => tally.has(id)).slice(0, slots);
        if (order.length === 0) continue;
        voters += 1;
        order.forEach((id, place) => {
          const t = tally.get(id)!;
          t.points += slots - place;
          if (place === 0) t.first += 1;
        });
      }
      // most points first; ties: more first choices, then the order options were listed in
      const items = [...tally.values()].sort((a, b) => b.points - a.points || b.first - a.first);
      return { ...base, kind: "ranking", voters, items };
    }
    case "board": {
      const photos = source?.kind === "photo";
      type Item = Extract<ComposeViewResult, { kind: "board" }>["items"][number];
      const items: Item[] = rows
        .filter((r) => typeof r.values[source?.id ?? ""] === "string" && r.values[source!.id] !== "")
        .flatMap((r): Item[] => {
          const id = entryIdOf(r.participantHash, r.itemId ?? "");
          const likedBy = ctx.likes?.get(id);
          const mine = !!ctx.viewerId && id.startsWith(ctx.viewerId);
          const base = { id, name: r.name, likes: likedBy?.size ?? 0, mine, liked: !!ctx.viewerId && !!likedBy?.has(ctx.viewerId) };
          if (!photos) return [{ ...base, text: String(r.values[source!.id]) }];
          // the photo's caption: the block's first text input, if any
          // A photo shows only if it is the author's own upload, and to others only once the host approved it.
          const photoId = String(r.values[source!.id]);
          if (!photoId.startsWith(`p-${r.participantHash.slice(0, 12)}-`) || !ctx.photoUrl) return [];
          const approved = !!ctx.approved?.has(photoId);
          if (!approved && !isHost && !mine) return [];
          const caption = inputs.find((i) => i.kind === "text");
          const text = caption && typeof r.values[caption.id] === "string" ? String(r.values[caption.id]) : "";
          return [{ ...base, text, photo: ctx.photoUrl(photoId), photoId: isHost ? photoId : undefined, approved }];
        })
        // most liked first; ties keep posting order (stable sort)
        .sort((a, b) => b.likes - a.likes);
      // The host must reach every photo still waiting for approval, however many are liked above it.
      const waiting = photos && isHost ? items.filter((i) => !i.approved) : [];
      const shown = photos && isHost ? items.filter((i) => i.approved) : items;
      return { ...base, kind: "board", items: [...waiting, ...shown.slice(0, view.topN ?? BOARD_MAX_ITEMS)] };
    }
    case "chat": {
      // Rows exclude removed entries; oldest first, only the newest CHAT_MAX_MESSAGES are sent.
      const messages = rows
        .flatMap((r) => {
          const text = source ? r.values[source.id] : undefined;
          if (typeof text !== "string" || text === "") return [];
          const id = entryIdOf(r.participantHash, r.itemId ?? "");
          return [{ id, author: r.name, text, at: r.createdAt ?? 0, mine: !!ctx.viewerId && id.startsWith(ctx.viewerId) }];
        })
        .sort((a, b) => a.at - b.at);
      return { ...base, kind: "chat", messages: messages.slice(-CHAT_MAX_MESSAGES) };
    }
    case "map": {
      // Re-parsed here too: a stored value that isn't a valid point never reaches a viewer.
      const points = rows.flatMap((r) => {
        const point = source ? parseLatLng(r.values[source.id]) : null;
        return point ? [{ ...point, name: r.name, mine: !!ctx.viewerId && r.participantHash.startsWith(ctx.viewerId) }] : [];
      });
      return { ...base, kind: "map", points: points.slice(-MAP_MAX_POINTS) };
    }
    case "settle":
      return { ...base, kind: "settle", ...computeSettleView(view, ctx) };
    case "teams": {
      const nameOf = new Map(roster.map((r) => [r.id, r.name]));
      const drawn = new Set(ctx.teams?.flat() ?? []);
      const teams = ctx.teams ? ctx.teams.map((ids, i) => ({ name: `Đội ${i + 1}`, members: ids.map((id) => nameOf.get(id) ?? "?") })) : null;
      const waiting = ctx.teams ? roster.filter((r) => !drawn.has(r.id)).map((r) => r.name) : [];
      return { ...base, kind: "teams", joined: roster.length, teams, waiting };
    }
  }
}
