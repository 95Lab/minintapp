// Pure helpers behind the compose views that aren't arithmetic: slot seating, settle-up transfers,
// option lists (fixed, stars, roster people, dates) and table formatting. Numbers come from the
// query engine (compose-query-engine.ts); these decide who sits where and how values read.
import { DEFAULT_RATING_MAX, type ComposeInput, type ComposeValue } from "./compose-atoms-schema";
import { resultLabels, type ResultLabels } from "@/engine/i18n/result-labels-vi-en";
import { round2, selectedIds } from "./compose-value-basics";

/** One stored record (a person's answer, one list entry, or a person's merged steps). */
export interface ComposeRow {
  /** unique per record (participant + itemId) */
  key: string;
  participantHash: string;
  name: string;
  values: Record<string, ComposeValue>;
  /** the record's own itemId (list entries, one-record blocks); absent for merged steps */
  itemId?: string;
  /** when the server stored this record (ms) — a chat message's time */
  createdAt?: number;
  /** steps flow: when the server received each step's answer (ms), e.g. buzzer press times */
  at?: Record<string, number>;
}

/** A participant as other people see them: short public id + display name. */
export interface RosterEntry {
  id: string;
  name: string;
}

export { round2, selectedIds };

/**
 * Slot seats: first come, first served in submission order; the rest wait. One person holds at most
 * one seat per option (several list entries for the same slot don't fill it up).
 * Returns row key → true when that record holds a seat for this slot input.
 */
export function allocateSlots(input: ComposeInput, rows: ComposeRow[]): Map<string, boolean> {
  const seated = new Map<string, boolean>();
  const holders = new Map<string, Set<string>>();
  for (const row of rows) {
    const choice = row.values[input.id];
    if (typeof choice !== "string") continue;
    const people = holders.get(choice) ?? new Set<string>();
    const ok = !people.has(row.participantHash) && (input.capacity === null || people.size < input.capacity);
    if (ok) people.add(row.participantHash);
    holders.set(choice, people);
    seated.set(row.key, ok);
  }
  return seated;
}

const formatDate = (v: string) => {
  const [date, time] = v.split("T");
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}${time ? ` ${time}` : ""}`;
};

/** What a participant can pick for an input, as {id, label}: fixed options, stars, roster people, or dates seen in answers. */
export function optionsOf(input: ComposeInput, rows: ComposeRow[], roster: RosterEntry[]): Array<{ id: string; label: string }> {
  if (input.kind === "rating") return Array.from({ length: input.max ?? DEFAULT_RATING_MAX }, (_, i) => ({ id: String(i + 1), label: `${i + 1}★` }));
  if (input.kind === "person") return roster.map((r) => ({ id: r.id, label: r.name }));
  if (input.kind === "date" || input.kind === "datetime") {
    const values = [...new Set(rows.map((r) => r.values[input.id]).filter((v): v is string => typeof v === "string" && v !== ""))].sort();
    return values.map((v) => ({ id: v, label: formatDate(v) }));
  }
  return (input.options ?? []).map((o) => ({ id: o.id, label: o.label }));
}

/** Human-readable cell for tables. */
export function formatComposeValue(input: ComposeInput, value: ComposeValue | undefined, roster: RosterEntry[] = [], waitlisted = false, labels: ResultLabels = resultLabels("vi")): string {
  if (value === undefined || value === "") return "";
  if (input.kind === "number" && typeof value === "number") return `${value.toLocaleString(labels.numberLocale)}${!input.unit ? "" : input.unit === "đ" ? "đ" : ` ${input.unit}`}`;
  if (input.kind === "rating" && typeof value === "number") return `${value}★`;
  if ((input.kind === "date" || input.kind === "datetime") && typeof value === "string") return formatDate(value);
  if (input.kind === "person") return selectedIds(value).map((id) => roster.find((r) => r.id === id)?.name ?? "?").join(", ");
  if (input.kind === "photo") return typeof value === "string" ? "📷" : "";
  if (input.kind === "place") return typeof value === "string" ? value : "";
  if (input.kind === "buzz") return value === 1 ? "✓" : "";
  if (input.kind === "rank") return selectedIds(value).map((id) => input.options?.find((o) => o.id === id)?.label ?? id).join(" > ");
  if (input.kind === "choice" || input.kind === "slot") {
    const picked = selectedIds(value).map((id) => input.options?.find((o) => o.id === id)?.label ?? id);
    return picked.join(", ") + (waitlisted ? ` (${labels.waitlisted})` : "");
  }
  return String(value);
}

/** True when any choice/slot option carries a price (the orders view then shows money). */
export const hasPrices = (inputs: ComposeInput[]) => inputs.some((i) => i.options?.some((o) => (o.price ?? 0) > 0));

/** Minimum-ish set of transfers that settles everyone to an equal share (greedy largest-first). */
export function settleTransfers(people: Array<{ name: string; balance: number }>): Array<{ from: string; to: string; amount: number }> {
  const debtors = people.filter((p) => p.balance < -0.005).map((p) => ({ ...p, left: -p.balance })).sort((a, b) => b.left - a.left);
  const creditors = people.filter((p) => p.balance > 0.005).map((p) => ({ ...p, left: p.balance })).sort((a, b) => b.left - a.left);
  const transfers: Array<{ from: string; to: string; amount: number }> = [];
  let d = 0;
  let c = 0;
  while (d < debtors.length && c < creditors.length) {
    const amount = Math.min(debtors[d].left, creditors[c].left);
    if (amount >= 0.01) transfers.push({ from: debtors[d].name, to: creditors[c].name, amount: round2(amount) });
    debtors[d].left -= amount;
    creditors[c].left -= amount;
    if (debtors[d].left < 0.005) d += 1;
    if (creditors[c].left < 0.005) c += 1;
  }
  return transfers;
}
