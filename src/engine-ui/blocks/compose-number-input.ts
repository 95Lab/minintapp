// Reads a number typed on a phone the way people actually type it. Number inputs are plain text
// fields (type="number" rejects "2,5" / "50.000" on Vietnamese keyboards and blocks decimals without
// step="any"), so parsing happens here:
//   money ("đ"): "50.000" / "50,000" / "50 000" → 50000, "50k" → 50000, "1,2tr" → 1200000
//   other:       "2,5" or "2.5" → 2.5; several separators ("1.234.567") are thousands
export function parseNumberInput(raw: string, unit: string | null): number | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, "");
  if (!s) return null;
  if (unit === "đ") {
    const m = s.match(/^(-?[\d.,]+)(k|tr|triệu)?đ?$/);
    if (!m) return null;
    const scale = m[2] === "k" ? 1_000 : m[2] ? 1_000_000 : 1;
    // With a k/tr suffix a single separator is decimal ("1,2tr"); without, separators group thousands.
    const base = scale > 1 ? m[1].replace(",", ".") : m[1].replace(/[.,]/g, "");
    const n = Number(base) * scale;
    return Number.isFinite(n) ? Math.round(n) : null;
  }
  if (!/^-?[\d.,]+$/.test(s)) return null;
  const separators = s.match(/[.,]/g) ?? [];
  const n = Number(separators.length > 1 ? s.replace(/[.,]/g, "") : s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
