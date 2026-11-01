export type Locale = "vi" | "en";
export const LOCALE_COOKIE = "minint-locale";
export function resolveLocale(value: string | undefined): Locale {
  return value === "en" || value === "ja" ? "en" : "vi";
}

export type InterfaceLanguage = Locale | "ja";
export function resolveLanguage(value:string|undefined):InterfaceLanguage{return value==="ja"?"ja":resolveLocale(value);}
