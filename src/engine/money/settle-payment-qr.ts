// What a settle-up screen puts in a VietQR for the viewer. Collect rule: when the host set a payee, the
// host is the cashier — each person who owes pays their whole net debt to the payee, and whoever is
// owed gets paid back by the host. (The server can't tell which roster entry is the host, so the QR is
// never "to a person"; it always pays the account the host typed in.)
import type { PublicPayee } from "./payee";
import { vietqrNote, vietqrPayload } from "./vietqr-payload";

const VND_UNITS = new Set(["đ", "d", "vnd", "vnđ"]);

/** A QR is only offered for amounts in đồng: no unit, or đ / VND. */
export const isVndUnit = (unit: string | null) => unit === null || VND_UNITS.has(unit.trim().toLowerCase());

/** What the viewer still owes (whole đồng): their net debt minus what the host already received; 0 when even, owed money or paid up. */
export function amountOwedBy(person: { balance: number; receivedAmount?: number } | undefined): number {
  return person && person.balance < 0 ? Math.max(0, -person.balance - (person.receivedAmount ?? 0)) : 0;
}

/** Transfer note "<app title> <viewer name>", plain ASCII and short enough for every banking app. */
export const paymentNote = (appTitle: string, name: string) => `${vietqrNote(appTitle).slice(0, 22)} ${vietqrNote(name)}`.trim();

/** The text inside the QR for paying `amount` to the payee. */
export function paymentQrText(payee: PublicPayee, amount: number, appTitle: string, name: string): string {
  return vietqrPayload({ bin: payee.bin, account: payee.account, amount, note: paymentNote(appTitle, name) });
}
