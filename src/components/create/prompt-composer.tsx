"use client";
import { translate } from "@/lib/i18n/messages";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useEffect, useRef, useState } from "react";
import type { GenerateRequest } from "@/lib/api/api-contract-types";
import { creationBlocked } from "@/lib/api/creation-availability";
import { CreationAvailabilityNotice, useCreationAvailability, requireCreationAvailability } from "./creation-availability";
import { PlanningChat } from "./planning-chat";

export function PromptComposer({ onGenerate, disabled = false }: { onGenerate?: (request: GenerateRequest) => Promise<void>; disabled?: boolean }) {
  const { locale, language, localize } = useLocale();
  const tr = (message: Parameters<typeof translate>[1]) => translate(language, message);
  const availability = useCreationAvailability();
  const [checking, setChecking] = useState(false);
  const blocked = !!availability.availability && creationBlocked(availability.availability);
  const [prompt, setPrompt] = useState("");
  const [idea, setIdea] = useState("");
  const [open, setOpen] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const launchButton = useRef<HTMLButtonElement>(null);
  // Text typed or autofilled before hydration fires no onChange, which would leave the submit button disabled.
  useEffect(() => { if (field.current?.value) setPrompt(field.current.value); }, []);
  useEffect(() => { if (!open && idea) launchButton.current?.focus(); }, [open, idea]);
  return <>
    {onGenerate && <CreationAvailabilityNotice {...availability} locale={locale} />}
    <form className="mini-card" onSubmit={async e => { e.preventDefault(); if (!onGenerate || disabled || checking || !prompt.trim()) return; setChecking(true); const allowed = await availability.refresh(); setChecking(false); if (allowed) { setIdea(prompt.trim()); setOpen(true); } }}>
      <label className="mini-field">{tr("Bạn cần mini-app gì?")}<textarea ref={field} required maxLength={500} placeholder={tr("Ví dụ: Tạo bình chọn đồ uống cho buổi workshop chiều nay…")} rows={4} value={prompt} onChange={e => setPrompt(e.target.value)} disabled={disabled} /></label>
      <p className="caption-2">{localize("Chat cùng AI để làm rõ ý tưởng. Chốt yêu cầu rồi mới tạo app.","Chat with AI to shape your idea. Confirm the brief before creating.")}</p>
      <button ref={launchButton} type="submit" disabled={!onGenerate || disabled || checking || blocked || !prompt.trim()}>{localize("Trao đổi ý tưởng","Discuss your idea")}</button>
      {!onGenerate && <p>{tr("Chức năng tạo ứng dụng chưa kết nối API.")}</p>}
    </form>
    {idea && onGenerate && <PlanningChat key={idea} open={open} initialPrompt={idea} locale={locale} onClose={() => setOpen(false)} onGenerate={async input => { await requireCreationAvailability(locale); await onGenerate(input); }} />}
  </>;
}
