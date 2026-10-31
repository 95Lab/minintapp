"use client";
import { translate } from "@/lib/i18n/messages";
import { useLocale } from "@/lib/i18n/locale-provider";
import { ApiClientError } from "@/lib/api/api-client";
import { useState } from "react";
import type { GenerateRequest, Lifetime } from "@/lib/api/api-contract-types";
export function PromptComposer({ onGenerate, disabled = false }: { onGenerate?: (request: GenerateRequest) => Promise<void>; disabled?: boolean }) {
  const { locale } = useLocale();
  const tr = (message: Parameters<typeof translate>[1]) => translate(locale, message);
  const [prompt, setPrompt] = useState(""); const [lifetime, setLifetime] = useState<Lifetime>("1h"); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  return <form className="mini-card" onSubmit={async (e) => { e.preventDefault(); if (!onGenerate || !prompt.trim() || busy || disabled) return; setBusy(true); setError(""); try { await onGenerate({ prompt: prompt.trim(), lifetime }); } catch (error) { setError(error instanceof ApiClientError ? error.message : tr("Không thể tạo ứng dụng. Vui lòng thử lại.")); } finally { setBusy(false); } }}><label className="mini-field">{tr("Bạn cần mini-app gì?")}<textarea required maxLength={500} placeholder={tr("Ví dụ: Tạo bình chọn đồ uống cho buổi workshop chiều nay…")} rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} disabled={busy || disabled} /></label><label className="mini-field">{tr("Thời gian sử dụng")}<select value={lifetime} onChange={(e) => setLifetime(e.target.value as Lifetime)} disabled={busy || disabled}><option value="1h">{tr("1 giờ")}</option><option value="24h">{tr("24 giờ")}</option><option value="7d">{tr("7 ngày")}</option></select></label><button disabled={!onGenerate || busy || disabled || !prompt.trim()}>{busy ? tr("Đang tạo…") : tr("Tạo ứng dụng")}</button>{!onGenerate && <p>{tr("Chức năng tạo ứng dụng chưa kết nối API.")}</p>}{error && <p role="alert">{error}</p>}</form>;
}
