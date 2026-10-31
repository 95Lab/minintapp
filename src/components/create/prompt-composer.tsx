"use client";
import { translate } from "@/lib/i18n/messages";
import { useLocale } from "@/lib/i18n/locale-provider";
import { ApiClientError } from "@/lib/api/api-client";
import { useState } from "react";
import type { GenerateRequest, Lifetime } from "@/lib/api/api-contract-types";

export function PromptComposer({ onGenerate, disabled = false }: { onGenerate?: (request: GenerateRequest) => Promise<void>; disabled?: boolean }) {
  const { locale } = useLocale();
  const tr = (message: Parameters<typeof translate>[1]) => translate(locale, message);
  const text = (vi: string, en: string) => locale === "vi" ? vi : en;
  const [prompt, setPrompt] = useState("");
  const [lifetime, setLifetime] = useState<Lifetime>("1h");
  const [step, setStep] = useState<"describe" | "clarify" | "review">("describe");
  const [audience, setAudience] = useState("");
  const [interaction, setInteraction] = useState("");
  const [outcome, setOutcome] = useState("");
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const locked = busy || disabled;
  const draft = [prompt.trim(), audience.trim() && `${text("Người dùng", "Audience")}: ${audience.trim()}`, interaction.trim() && `${text("Tương tác", "Interaction")}: ${interaction.trim()}`, outcome.trim() && `${text("Kết quả", "Outcome")}: ${outcome.trim()}`].filter(Boolean).join("\n");
  return <form className="mini-card" onSubmit={async (e) => {
    e.preventDefault();
    if (locked) return;
    setError("");
    if (step === "describe") { if (prompt.trim()) setStep("clarify"); return; }
    if (step === "clarify") { setBrief(draft); setStep("review"); return; }
    if (!onGenerate || !brief.trim() || brief.trim().length > 500) return;
    setBusy(true);
    try { await onGenerate({ prompt: brief.trim(), lifetime }); }
    catch (error) { setError(error instanceof ApiClientError ? error.message : tr("Không thể tạo ứng dụng. Vui lòng thử lại.")); }
    finally { setBusy(false); }
  }}>
    <p className="caption-2" role="status">{text("Bước", "Step")} {step === "describe" ? "1/3 · " + text("Ý tưởng", "Idea") : step === "clarify" ? "2/3 · " + text("Làm rõ", "Clarify") : "3/3 · " + text("Chốt yêu cầu", "Review")}</p>
    {step === "describe" && <label className="mini-field">{tr("Bạn cần mini-app gì?")}<textarea required maxLength={500} placeholder={tr("Ví dụ: Tạo bình chọn đồ uống cho buổi workshop chiều nay…")} rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} disabled={locked} /></label>}
    {step === "clarify" && <>
      <p>{text("Bổ sung những điều quan trọng. Có thể để trống nếu mô tả ban đầu đã đủ rõ.", "Add the details that matter. Leave fields empty if your original description already covers them.")}</p>
      <label className="mini-field">{text("Ai sẽ dùng app, trong dịp nào?", "Who will use the app, and when?")}<textarea rows={2} maxLength={150} value={audience} onChange={(e) => setAudience(e.target.value)} disabled={locked} /></label>
      <label className="mini-field">{text("Mọi người cần nhập gì hoặc thực hiện thao tác nào?", "What should people enter or do?")}<textarea rows={2} maxLength={200} value={interaction} onChange={(e) => setInteraction(e.target.value)} disabled={locked} /></label>
      <label className="mini-field">{text("Bạn muốn xem kết quả gì? Có quy tắc đặc biệt không?", "What results do you need? Any special rules?")}<textarea rows={2} maxLength={200} value={outcome} onChange={(e) => setOutcome(e.target.value)} disabled={locked} /></label>
    </>}
    {step === "review" && <>
      <p>{text("Đọc và sửa bản yêu cầu bên dưới. Chỉ khi xác nhận, hệ thống mới bắt đầu tạo app.", "Review and edit the brief below. Creation starts only after you confirm.")}</p>
      <label className="mini-field">{text("Yêu cầu sẽ gửi để tạo app", "Brief used to create the app")}<textarea required rows={7} value={brief} onChange={(e) => setBrief(e.target.value)} disabled={locked} aria-describedby="brief-length" /></label>
      <p id="brief-length" role={brief.trim().length > 500 ? "alert" : undefined}>{brief.trim().length}/500 {text("ký tự", "characters")}{brief.trim().length > 500 && text(" · Hãy rút gọn yêu cầu trước khi tạo.", " · Shorten the brief before creating.")}</p>
      <label className="mini-field">{tr("Thời gian sử dụng")}<select value={lifetime} onChange={(e) => setLifetime(e.target.value as Lifetime)} disabled={locked}><option value="1h">{tr("1 giờ")}</option><option value="24h">{tr("24 giờ")}</option><option value="7d">{tr("7 ngày")}</option></select></label>
    </>}
    {step !== "describe" && <button type="button" disabled={locked} onClick={() => { setError(""); setStep(step === "review" ? "clarify" : "describe"); }}>{text("Quay lại", "Back")}</button>}
    <button type="submit" disabled={locked || (step === "describe" && !prompt.trim()) || (step === "review" && (!onGenerate || !brief.trim() || brief.trim().length > 500))}>{busy ? tr("Đang tạo…") : step === "describe" ? text("Tiếp tục làm rõ", "Clarify details") : step === "clarify" ? text("Xem lại yêu cầu", "Review brief") : text("Xác nhận và tạo ứng dụng", "Confirm and create app")}</button>
    {!onGenerate && <p>{tr("Chức năng tạo ứng dụng chưa kết nối API.")}</p>}
    {error && <p role="alert">{error}</p>}
  </form>;
}
