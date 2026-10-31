"use client";
import { translate } from "@/lib/i18n/messages";
import { useLocale } from "@/lib/i18n/locale-provider";
import { LanguageSwitcher } from "@/lib/i18n/locale-provider";
import Link from "next/link";
export function BrandTopBar({ children }: { children?: React.ReactNode }) {
  const { locale } = useLocale();
  const tr = (message: Parameters<typeof translate>[1]) => translate(locale, message);
  return <header className="mini-topbar"><Link href="/" aria-label={tr("Trang chủ MinintApp")}>MinintApp</Link><nav aria-label={tr("Điều hướng chính")}><Link href="/dashboard">{tr("Ứng dụng của tôi")}</Link>{children}<LanguageSwitcher /></nav></header>;
}
