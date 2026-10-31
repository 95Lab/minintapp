"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { Locale } from "./locale";
import { translate, type Message } from "./messages";

// App content follows spec.locale, independently of the dashboard language.
const RuntimeLocale = createContext<Locale>("vi");
export function RuntimeLocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <RuntimeLocale.Provider value={locale}>{children}</RuntimeLocale.Provider>;
}
export function useRuntimeTranslation(override?: Locale) {
  const inherited = useContext(RuntimeLocale);
  const locale = override ?? inherited;
  return (message: Message, values?: Record<string, string | number>) => translate(locale, message, values);
}
