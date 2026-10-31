// The host's bank account for a settle-up view: bank (fixed NAPAS list), account number and account
// holder name. Only the host can set it (lifecycle "payee", host token) and never the AI — so a QR the
// app shows can only point at an account its host typed in.
import { z } from "zod";
import { NAPAS_BINS, bankName, type NapasBin } from "./napas-banks";

export interface Payee {
  bin: NapasBin;
  /** digits only, 6–19 */
  account: string;
  /** account holder as banks print it: A–Z and spaces */
  name: string;
}

/** What /state shows everyone: the payee plus its bank's short name. */
export interface PublicPayee extends Payee {
  bankName: string;
}

export const publicPayee = (p: Payee | null): PublicPayee | null => (p ? { ...p, bankName: bankName(p.bin) } : null);

/** Banks print holder names in capitals without accents: "Nguyễn Văn Đạt" → "NGUYEN VAN DAT". */
export function normalizeAccountName(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "D")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

export const PayeeInputSchema = z
  .object({
    bin: z.enum(NAPAS_BINS),
    account: z.string().regex(/^\d{6,19}$/),
    name: z.string().max(100).transform(normalizeAccountName).pipe(z.string().regex(/^[A-Z ]{2,50}$/)),
  })
  .strict();
export type PayeeInput = z.input<typeof PayeeInputSchema>;
