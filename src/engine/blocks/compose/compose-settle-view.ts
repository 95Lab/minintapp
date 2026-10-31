// Settle-up view: from an expense log (entries "many") work out who is owed what and the fewest
// transfers that square everyone. Source = the amount input; the payer is whoever logged the entry; it
// is shared among the people picked in the block's multi `person` input ("chia cho"), or among the
// whole roster when there is none or the entry left it empty. The arithmetic lives in lib/money.
import { balancesOf, settleTransfers, type Expense } from "@/engine/money/settle-transfers";
import { rosterIdOf, type ComposeView } from "./compose-atoms-schema";
import { selectedIds } from "./compose-value-basics";
import type { ViewContext } from "./compose-view-aggregators";

export interface SettlePerson {
  id: string;
  name: string;
  /** whole đồng laid out by this person */
  paid: number;
  /** positive = is owed, negative = owes */
  balance: number;
  mine: boolean;
  /** whole đồng the host has confirmed receiving from this person */
  receivedAmount: number;
  /** what this person still owes: their debt minus the confirmed amount, never below 0 */
  remaining: number;
  /** the person said "I've transferred" and the amount they named is what they still owe */
  markedPaid: boolean;
  /** the person said "I've transferred", but the amount they named is no longer what they owe */
  markOutdated: boolean;
  /** the host confirmed receiving something from them */
  received: boolean;
}

export interface SettleTransferLine {
  from: string;
  to: string;
  fromId: string;
  toId: string;
  amount: number;
  /** the viewer is the one paying / the one receiving */
  mine: "pay" | "receive" | null;
  /** the payer's marks (see SettlePerson) */
  markedPaid: boolean;
  markOutdated: boolean;
  received: boolean;
  receivedAmount: number;
}

export interface SettleResult {
  unit: string | null;
  total: number;
  people: SettlePerson[];
  transfers: SettleTransferLine[];
}

export function computeSettleView(view: ComposeView, ctx: ViewContext): SettleResult {
  const { inputs, rows, roster } = ctx;
  const source = inputs.find((i) => i.id === view.source);
  const sharedWith = inputs.find((i) => i.kind === "person" && i.multi);
  const everyone = roster.map((r) => r.id);
  const known = new Set(everyone);

  const expenses: Expense[] = rows.flatMap((r) => {
    const amount = source ? r.values[source.id] : undefined;
    if (typeof amount !== "number" || Math.round(amount) <= 0) return [];
    // Unknown ids (a person who is no longer on the roster) are ignored; nobody left → everyone.
    const picked = sharedWith ? selectedIds(r.values[sharedWith.id]).filter((id) => known.has(id)) : [];
    return [{ payer: rosterIdOf(r.participantHash), amount, among: picked.length ? picked : everyone }];
  });

  const balances = balancesOf(expenses);
  const laidOut = new Map<string, number>();
  for (const e of expenses) laidOut.set(e.payer, (laidOut.get(e.payer) ?? 0) + Math.round(e.amount));
  const nameOf = new Map(roster.map((r) => [r.id, r.name]));
  const is = (id: string) => !!ctx.viewerId && id === ctx.viewerId;

  // A person's marks against their CURRENT debt: a mark names the amount owed when it was made, so after a
  // new expense it no longer matches and shows as outdated; what the host received is taken off the debt.
  const marksOf = (id: string) => {
    const debt = Math.max(0, -(balances.get(id) ?? 0));
    const receivedAmount = ctx.received?.get(id) ?? 0;
    const remaining = Math.max(0, debt - receivedAmount);
    const named = ctx.paidMarks?.get(id);
    const marked = named !== undefined && remaining > 0;
    return { receivedAmount, remaining, markedPaid: marked && named === remaining, markOutdated: marked && named !== remaining, received: receivedAmount > 0 };
  };
  const people = expenses.length
    ? roster.map((r): SettlePerson => ({
        id: r.id,
        name: r.name,
        paid: laidOut.get(r.id) ?? 0,
        balance: balances.get(r.id) ?? 0,
        mine: is(r.id),
        ...marksOf(r.id),
      }))
    : [];
  const transfers = settleTransfers(expenses).map((t): SettleTransferLine => {
    const { receivedAmount, markedPaid, markOutdated, received } = marksOf(t.from);
    return { from: nameOf.get(t.from) ?? "?", to: nameOf.get(t.to) ?? "?", fromId: t.from, toId: t.to, amount: t.amount, mine: is(t.from) ? "pay" : is(t.to) ? "receive" : null, markedPaid, markOutdated, received, receivedAmount };
  });
  return { unit: source?.unit ?? null, total: [...laidOut.values()].reduce((a, b) => a + b, 0), people, transfers };
}
