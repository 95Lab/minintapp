"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LOCALE_COOKIE, type Locale } from "./locale";
const LocaleContext = createContext<{ locale: Locale; setLocale: (locale: Locale) => void } | null>(null);
export function LocaleProvider({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }) {
  const [locale, updateLocale] = useState(initialLocale);
  const router = useRouter();
  function setLocale(next: Locale) {
    document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    try { localStorage.setItem("minint:ui-locale", next); } catch { /* Cookies remain the source of truth. */ }
    updateLocale(next);
    document.documentElement.lang = next;
    router.refresh();
  }
  return <LocaleContext.Provider value={{ locale, setLocale }}>{children}</LocaleContext.Provider>;
}
export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale requires LocaleProvider");
  return context;
}
export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();
  return <div className="segmented locale-switcher" role="group" aria-label={locale === "vi" ? "Ngôn ngữ" : "Language"}>
    {(["vi", "en"] as const).map((value) => <button key={value} type="button" lang={value} aria-pressed={locale === value} onClick={() => setLocale(value)}>{value.toUpperCase()}</button>)}
  </div>;
}
