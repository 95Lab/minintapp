// VietQR (NAPAS 247 "transfer to account") payload: the EMVCo merchant-presented QR text that every
// Vietnamese banking app scans. Built locally — no third-party QR service sees who pays whom.
// Layout: tag(2) + length(2) + value, nested for the merchant account (38) and extra data (62),
// closed by a CRC16-CCITT over everything before it, including "6304".

const tlv = (tag: string, value: string) => `${tag}${String(value.length).padStart(2, "0")}${value}`;

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF), as EMVCo QR requires; 4 uppercase hex digits. */
export function crc16Ccitt(text: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(text)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Bank apps accept only plain ASCII letters/digits/spaces in the note. */
export const vietqrNote = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, (c) => (c === "đ" ? "d" : "D"))
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50);

export interface VietqrInput {
  bin: string;
  account: string;
  /** whole VND; omitted → the payer types the amount */
  amount?: number;
  note?: string;
}

export function vietqrPayload({ bin, account, amount, note }: VietqrInput): string {
  const beneficiary = tlv("00", bin) + tlv("01", account);
  const merchant = tlv("00", "A000000727") + tlv("01", beneficiary) + tlv("02", "QRIBFTTA");
  const cleanNote = note ? vietqrNote(note) : "";
  const body =
    tlv("00", "01") +
    tlv("01", amount ? "12" : "11") +
    tlv("38", merchant) +
    tlv("53", "704") +
    (amount ? tlv("54", String(Math.round(amount))) : "") +
    tlv("58", "VN") +
    (cleanNote ? tlv("62", tlv("08", cleanNote)) : "") +
    "6304";
  return body + crc16Ccitt(body);
}
