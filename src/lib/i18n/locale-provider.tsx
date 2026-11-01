"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LOCALE_COOKIE, type Locale, type InterfaceLanguage } from "./locale";
import {toJapanese} from "./japanese";
const LocaleContext = createContext<{ locale: Locale; language: InterfaceLanguage; localize: (vi:string,en:string)=>string; setLocale: (locale: InterfaceLanguage) => void; platformOrigin: string } | null>(null);
export function LocaleProvider({ initialLocale, children, platformOrigin = "" }: { initialLocale: InterfaceLanguage; children: ReactNode; platformOrigin?: string }) {
  const [language, updateLocale] = useState(initialLocale);
  const router = useRouter();
  function setLocale(next: InterfaceLanguage) {
    document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    try { localStorage.setItem("minint:ui-locale", next); } catch { /* Cookies remain the source of truth. */ }
    updateLocale(next);
    document.documentElement.lang = next;
    router.refresh();
  }
  return <LocaleContext.Provider value={{ locale:language==="ja"?"en":language, language, localize:(vi,en)=>language==="ja"?toJapanese(en):language==="vi"?vi:en, setLocale, platformOrigin }}>{children}</LocaleContext.Provider>;
}
export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale requires LocaleProvider");
  return context;
}
export function LanguageSwitcher() {
  const { language, setLocale } = useLocale();
  return <div className="segmented locale-switcher" role="group" aria-label={language === "ja" ? "言語" : language === "vi" ? "Ngôn ngữ" : "Language"}>
    {(["vi", "en", "ja"] as const).map((value) => <button key={value} type="button" lang={value} aria-pressed={language === value} onClick={() => setLocale(value)}>{value==="ja"?"日本語":value.toUpperCase()}</button>)}
  </div>;
}
