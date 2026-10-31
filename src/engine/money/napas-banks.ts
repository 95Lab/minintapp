// Banks a host can receive VietQR transfers at: NAPAS BIN (the bank's id inside a VietQR code) and a
// short name. A fixed list on purpose — the bank in a payment QR is never free text, and never chosen
// by the AI.
export const NAPAS_BANKS = [
  { bin: "970436", name: "Vietcombank" },
  { bin: "970415", name: "VietinBank" },
  { bin: "970418", name: "BIDV" },
  { bin: "970405", name: "Agribank" },
  { bin: "970407", name: "Techcombank" },
  { bin: "970422", name: "MB Bank" },
  { bin: "970416", name: "ACB" },
  { bin: "970432", name: "VPBank" },
  { bin: "970423", name: "TPBank" },
  { bin: "970403", name: "Sacombank" },
  { bin: "970437", name: "HDBank" },
  { bin: "970441", name: "VIB" },
  { bin: "970443", name: "SHB" },
  { bin: "970431", name: "Eximbank" },
  { bin: "970426", name: "MSB" },
  { bin: "970448", name: "OCB" },
  { bin: "970440", name: "SeABank" },
  { bin: "970449", name: "LPBank" },
  { bin: "970428", name: "Nam A Bank" },
  { bin: "970454", name: "BVBank" },
  { bin: "970412", name: "PVcomBank" },
  { bin: "970452", name: "Kienlongbank" },
] as const;

export type NapasBin = (typeof NAPAS_BANKS)[number]["bin"];
export const NAPAS_BINS = NAPAS_BANKS.map((b) => b.bin) as [NapasBin, ...NapasBin[]];
export const bankName = (bin: string) => NAPAS_BANKS.find((b) => b.bin === bin)?.name ?? bin;
