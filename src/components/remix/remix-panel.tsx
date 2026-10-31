"use client";
import { useRuntimeTranslation } from "@/lib/i18n/runtime-locale";

import { useState } from "react";
export function RemixPanel({ onRemix }: { onRemix?: (instruction: string) => Promise<void> }) {
  const tr = useRuntimeTranslation();
  const [instruction, setInstruction] = useState(""); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  return <form className="mini-card" onSubmit={async (e) => { e.preventDefault(); if (!onRemix || !instruction.trim() || busy) return; setBusy(true); try { await onRemix(instruction.trim()); setMessage(tr("Đã gửi yêu cầu remix.")); } catch { setMessage(tr("Không thể remix. Vui lòng thử lại.")); } finally { setBusy(false); } }}><h2>{tr("Remix ứng dụng")}</h2><label className="mini-field">{tr("Bạn muốn thay đổi gì?")}<textarea required maxLength={300} value={instruction} disabled={busy || !onRemix} onChange={(e) => setInstruction(e.target.value)} /></label><button disabled={busy || !onRemix || !instruction.trim()}>Remix</button><p role="status">{message || (!onRemix ? tr("Remix chưa kết nối API.") : "")}</p></form>;
}
