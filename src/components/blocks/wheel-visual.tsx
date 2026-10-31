"use client";
import { useRuntimeTranslation } from "@/lib/i18n/runtime-locale";
export function WheelVisual({ entries, winner }: { entries: readonly { id: string; label: string }[]; winner?: string }) {
  const tr = useRuntimeTranslation();
  return <div className="mini-wheel"><ul aria-label={tr("Danh sách bốc thăm")}>{entries.map((e) => <li key={e.id}>{e.label}</li>)}</ul><p role="status">{winner ? tr("Kết quả: {winner}", { winner }) : tr("Chờ host quay số")}</p></div>;
}
