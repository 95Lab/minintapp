"use client";
import { useRuntimeTranslation } from "@/lib/i18n/runtime-locale";
import { useId, useState } from "react";
export interface AppPageTab { id: string; label: string; content: React.ReactNode }
export function AppPagesTabs({ pages }: { pages: AppPageTab[] }) {
  const tr = useRuntimeTranslation();
  const prefix = useId();
  const [selected, setSelected] = useState(pages[0]?.id);
  const current = pages.find((p) => p.id === selected) ?? pages[0];
  if (!current) return null;
  return <div><div role="tablist" aria-label={tr("Các trang ứng dụng")} className="mini-tabs">{pages.map((p, i) => <button key={p.id} id={`${prefix}-tab-${p.id}`} type="button" role="tab" aria-selected={current.id === p.id} aria-controls={`${prefix}-panel-${p.id}`} tabIndex={current.id === p.id ? 0 : -1} onClick={() => setSelected(p.id)} onKeyDown={(e) => {
    const next = e.key === "ArrowRight" ? (i + 1) % pages.length : e.key === "ArrowLeft" ? (i - 1 + pages.length) % pages.length : e.key === "Home" ? 0 : e.key === "End" ? pages.length - 1 : -1;
    if (next >= 0) { e.preventDefault(); setSelected(pages[next].id); document.getElementById(`${prefix}-tab-${pages[next].id}`)?.focus(); }
  }}>{p.label}</button>)}</div><div role="tabpanel" id={`${prefix}-panel-${current.id}`} aria-labelledby={`${prefix}-tab-${current.id}`} tabIndex={0}>{current.content}</div></div>;
}
