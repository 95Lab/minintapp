"use client";
import {translate} from "@/lib/i18n/messages";
import type {InterfaceLanguage} from "@/lib/i18n/locale";
import { useRuntimeTranslation } from "@/lib/i18n/runtime-locale";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
export function SharePanelQr({ url, language }: { url: string; language?: InterfaceLanguage }) {
  const runtimeTr = useRuntimeTranslation();
  const tr:typeof runtimeTr=(message,values)=>language?translate(language,message,values):runtimeTr(message,values);
  const [qr, setQr] = useState<{ url: string; image: string } | null>(null); const [message, setMessage] = useState("");
  let safeUrl = "";
  try { const parsed = new URL(url); if (["http:", "https:"].includes(parsed.protocol) && !parsed.username && !parsed.password) safeUrl = parsed.href; } catch { /* Show an invalid link notice. */ }
  useEffect(() => { let active = true; if (safeUrl) QRCode.toDataURL(safeUrl, { width: 240, margin: 2 }).then((image) => { if (active) setQr({ url: safeUrl, image }); }).catch(() => { if (active) setMessage(tr("Không thể tạo mã QR.")); }); return () => { active = false; }; }, [safeUrl]);
  if (!safeUrl) return <p role="alert">{tr("Liên kết chia sẻ không hợp lệ.")}</p>;
  return <section className="mini-card"><h2>{tr("Chia sẻ ứng dụng")}</h2>{qr?.url === safeUrl && <img src={qr.image} alt={tr("Mã QR mở ứng dụng")} width={240} height={240} />}<p><a href={safeUrl} rel="noopener noreferrer">{safeUrl}</a></p><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(safeUrl); setMessage(tr("Đã sao chép liên kết.")); } catch { setMessage(tr("Không thể sao chép tự động. Bạn có thể sao chép liên kết bên trên.")); } }}>{tr("Sao chép liên kết")}</button><p role="status">{message}</p></section>;
}
