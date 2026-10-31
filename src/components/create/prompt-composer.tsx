"use client";
import { translate } from "@/lib/i18n/messages";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useState } from "react";
import type { GenerateRequest } from "@/lib/api/api-contract-types";
import { PlanningChat } from "./planning-chat";

export function PromptComposer({ onGenerate, disabled = false }: { onGenerate?: (request: GenerateRequest) => Promise<void>; disabled?: boolean }) {
  const { locale } = useLocale();
  const tr = (message: Parameters<typeof translate>[1]) => translate(locale, message);
  const [prompt, setPrompt] = useState("");
  const [idea, setIdea] = useState("");
  const [open, setOpen] = useState(false);
  return <>
    <form className="mini-card" onSubmit={e => { e.preventDefault(); if (!onGenerate || disabled || !prompt.trim()) return; setIdea(prompt.trim()); setOpen(true); }}>
      <label className="mini-field">{tr("Bạn cần mini-app gì?")}<textarea required maxLength={500} placeholder={tr("Ví dụ: Tạo bình chọn đồ uống cho buổi workshop chiều nay…")} rows={4} value={prompt} onChange={e => setPrompt(e.target.value)} disabled={disabled} /></label>
      <p className="caption-2">{locale === "vi" ? "Chat cùng AI để làm rõ ý tưởng. Chốt yêu cầu rồi mới tạo app." : "Chat with AI to shape your idea. Confirm the brief before creating."}</p>
      <button type="submit" disabled={!onGenerate || disabled || !prompt.trim()}>{locale === "vi" ? "Trao đổi ý tưởng" : "Discuss your idea"}</button>
      {!onGenerate && <p>{tr("Chức năng tạo ứng dụng chưa kết nối API.")}</p>}
    </form>
    {idea && onGenerate && <PlanningChat key={idea} open={open} initialPrompt={idea} locale={locale} onClose={() => setOpen(false)} onGenerate={onGenerate} />}
  </>;
}
