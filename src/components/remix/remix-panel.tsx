"use client";
import { useState } from "react";
export function RemixPanel({ onRemix }: { onRemix?: (instruction: string) => Promise<void> }) {
  const [instruction, setInstruction] = useState(""); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  return <form className="mini-card" onSubmit={async (e) => { e.preventDefault(); if (!onRemix || !instruction.trim() || busy) return; setBusy(true); try { await onRemix(instruction.trim()); setMessage("Đã gửi yêu cầu remix."); } catch { setMessage("Không thể remix. Vui lòng thử lại."); } finally { setBusy(false); } }}><h2>Remix ứng dụng</h2><label className="mini-field">Bạn muốn thay đổi gì?<textarea required maxLength={300} value={instruction} disabled={busy || !onRemix} onChange={(e) => setInstruction(e.target.value)} /></label><button disabled={busy || !onRemix || !instruction.trim()}>Remix</button><p role="status">{message || (!onRemix ? "Remix chưa kết nối API." : "")}</p></form>;
}
