// "Who pays whom": turn what each person paid and what each owes into the fewest transfers. Amounts
// are whole VND. Shares are split in whole đồng; the odd đồng left over goes to the first people in
// the given order, so balances always sum to exactly zero and the result is the same on every screen.

export interface Expense {
  /** who paid */
  payer: string;
  amount: number;
  /** who shares it (empty → nobody; callers pass the roster for "everyone") */
  among: string[];
}

export interface Transfer {
  from: string;
  to: string;
  amount: number;
}

/** Net balance per person: positive = should receive, negative = should pay. */
export function balancesOf(expenses: Expense[]): Map<string, number> {
  const balance = new Map<string, number>();
  const add = (who: string, delta: number) => balance.set(who, (balance.get(who) ?? 0) + delta);
  for (const e of expenses) {
    const amount = Math.round(e.amount);
    const among = [...new Set(e.among)];
    if (amount <= 0 || among.length === 0) continue;
    add(e.payer, amount);
    const share = Math.floor(amount / among.length);
    let rest = amount - share * among.length;
    for (const who of among) {
      add(who, -(share + (rest > 0 ? 1 : 0)));
      if (rest > 0) rest--;
    }
  }
  return balance;
}

/**
 * Greedy settle-up: the biggest debtor pays the biggest creditor until one of them is even. Gives at
 * most n-1 transfers; ties are broken by id so every screen shows the same list.
 */
export function settleTransfers(expenses: Expense[]): Transfer[] {
  const byAmount = (a: [string, number], b: [string, number]) => b[1] - a[1] || a[0].localeCompare(b[0]);
  const entries = [...balancesOf(expenses)];
  const creditors = entries.filter(([, v]) => v > 0).sort(byAmount);
  const debtors = entries.filter(([, v]) => v < 0).map(([k, v]): [string, number] => [k, -v]).sort(byAmount);
  const transfers: Transfer[] = [];
  let c = 0;
  let d = 0;
  while (c < creditors.length && d < debtors.length) {
    const amount = Math.min(creditors[c][1], debtors[d][1]);
    transfers.push({ from: debtors[d][0], to: creditors[c][0], amount });
    creditors[c][1] -= amount;
    debtors[d][1] -= amount;
    if (creditors[c][1] === 0) c++;
    if (debtors[d][1] === 0) d++;
  }
  return transfers;
}
