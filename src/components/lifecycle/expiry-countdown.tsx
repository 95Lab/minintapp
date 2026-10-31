"use client";
import { useRuntimeTranslation } from "@/lib/i18n/runtime-locale";
import { useEffect, useState } from "react";
export function ExpiryCountdown({ expiresAt }: { expiresAt: string }) {
  const tr = useRuntimeTranslation();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { const tick = () => setNow(Date.now()); tick(); const timer = setInterval(tick, 1000); return () => clearInterval(timer); }, []);
  const end = Date.parse(expiresAt);
  if (!Number.isFinite(end)) return <span>{tr("Thời gian hết hạn không hợp lệ.")}</span>;
  const seconds = now === null ? null : Math.max(0, Math.ceil((end - now) / 1000));
  return <time dateTime={expiresAt}>{seconds === null ? tr("Đang tính thời gian…") : seconds === 0 ? tr("Đã hết hạn") : tr("Còn {hours} giờ {minutes} phút {seconds} giây", { hours: Math.floor(seconds / 3600), minutes: Math.floor(seconds % 3600 / 60), seconds: seconds % 60 })}</time>;
}
