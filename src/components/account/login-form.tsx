"use client";
import { useRuntimeTranslation } from "@/lib/i18n/runtime-locale";

import { useState } from "react";
export function LoginForm({ onSendLink }: { onSendLink?: (email: string) => Promise<void> }) {
  const tr = useRuntimeTranslation();
  const [email, setEmail] = useState(""); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  return <form className="mini-card" onSubmit={async (e) => { e.preventDefault(); if (!onSendLink || busy) return; setBusy(true); try { await onSendLink(email.trim()); setMessage(tr("Kiểm tra email để tiếp tục đăng nhập.")); } catch { setMessage(tr("Không thể gửi liên kết. Vui lòng thử lại.")); } finally { setBusy(false); } }}><label className="mini-field">Email<input type="email" required maxLength={254} value={email} disabled={busy || !onSendLink} onChange={(e) => setEmail(e.target.value)} /></label><button disabled={busy || !onSendLink}>{tr("Gửi liên kết đăng nhập")}</button><p role="status">{message || (!onSendLink ? tr("Đăng nhập chưa kết nối dịch vụ xác thực.") : "")}</p></form>;
}
