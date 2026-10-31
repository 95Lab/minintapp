"use client";
import { useRuntimeTranslation } from "@/lib/i18n/runtime-locale";
import type { RowsViewProps } from "./block-ui-types";
export function ComposeBoardView({ rows, title }: RowsViewProps) {
  const tr = useRuntimeTranslation();
  return <section className="mini-card"><h3>{title ?? tr("Bảng ý tưởng")}</h3>{rows.length ? <ul>{rows.map((row) => <li key={row.id}><strong>{row.label}</strong>{row.value !== undefined && <span>: {row.value}</span>}</li>)}</ul> : <p>{tr("Chưa có dữ liệu.")}</p>}</section>;
}
