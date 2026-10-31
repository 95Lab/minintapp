"use client";
export interface TemplateCard { id: string; title: string; description: string }
export function TemplateGallery({ templates, onSelect }: { templates: readonly TemplateCard[]; onSelect?: (id: string) => void }) {
  return <section className="mini-card"><h2>Bắt đầu từ mẫu</h2><div className="mini-grid">{templates.map((t) => <button type="button" key={t.id} disabled={!onSelect} onClick={() => onSelect?.(t.id)}><strong>{t.title}</strong><span>{t.description}</span></button>)}</div>{!templates.length && <p>Chưa có mẫu ứng dụng.</p>}</section>;
}
