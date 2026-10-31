"use client";
import { useEffect, useState } from "react";
export function ExpiryCountdown({ expiresAt }: { expiresAt: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { const tick = () => setNow(Date.now()); tick(); const timer = setInterval(tick, 1000); return () => clearInterval(timer); }, []);
  const end = Date.parse(expiresAt);
  if (!Number.isFinite(end)) return <span>Thời gian hết hạn không hợp lệ.</span>;
  const seconds = now === null ? null : Math.max(0, Math.ceil((end - now) / 1000));
  return <time dateTime={expiresAt}>{seconds === null ? "Đang tính thời gian…" : seconds === 0 ? "Đã hết hạn" : `Còn ${Math.floor(seconds / 3600)} giờ ${Math.floor(seconds % 3600 / 60)} phút ${seconds % 60} giây`}</time>;
}
