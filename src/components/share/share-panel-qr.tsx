"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
export function SharePanelQr({ url }: { url: string }) {
  const [qr, setQr] = useState<{ url: string; image: string } | null>(null); const [message, setMessage] = useState("");
  let safeUrl = "";
  try { const parsed = new URL(url); if (["http:", "https:"].includes(parsed.protocol) && !parsed.username && !parsed.password) safeUrl = parsed.href; } catch { /* Show an invalid link notice. */ }
  useEffect(() => { let active = true; if (safeUrl) QRCode.toDataURL(safeUrl, { width: 240, margin: 2 }).then((image) => { if (active) setQr({ url: safeUrl, image }); }).catch(() => { if (active) setMessage("Không thể tạo mã QR."); }); return () => { active = false; }; }, [safeUrl]);
  if (!safeUrl) return <p role="alert">Liên kết chia sẻ không hợp lệ.</p>;
  return <section className="mini-card"><h2>Chia sẻ ứng dụng</h2>{qr?.url === safeUrl && <img src={qr.image} alt="Mã QR mở ứng dụng" width={240} height={240} />}<p><a href={safeUrl} rel="noopener noreferrer">{safeUrl}</a></p><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(safeUrl); setMessage("Đã sao chép liên kết."); } catch { setMessage("Không thể sao chép tự động. Bạn có thể sao chép liên kết bên trên."); } }}>Sao chép liên kết</button><p role="status">{message}</p></section>;
}
