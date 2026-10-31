"use client";
import { useRuntimeTranslation } from "@/lib/i18n/runtime-locale";
import { useLocale } from "@/lib/i18n/locale-provider";
import type { Locale } from "@/lib/i18n/locale";
import Link from "next/link";
export function ExpiredNotice({ title, reason = "expired", locale: appLocale }: { title?: string; locale?: Locale; reason?: "expired" | "ended" | "blocked" | "not_found" | "unavailable" }) {
  const { locale } = useLocale();
  const tr = useRuntimeTranslation(appLocale ?? locale);
  const messages = { unavailable: tr("Ứng dụng đã hết hạn, kết thúc hoặc bị chặn."), expired: tr("Ứng dụng đã hết hạn."), ended: tr("Ứng dụng đã kết thúc."), blocked: tr("Ứng dụng đã bị chặn."), not_found: tr("Không tìm thấy ứng dụng.") };
  return <section className="mini-card"><h2>{title ?? tr("Ứng dụng không còn hoạt động")}</h2><p>{messages[reason]}</p><Link href="/">{tr("Về trang chủ")}</Link></section>;
}
