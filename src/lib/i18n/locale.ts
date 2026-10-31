export type Locale = "vi" | "en";
export const LOCALE_COOKIE = "minint-locale";
export function resolveLocale(value: string | undefined): Locale {
  return value === "en" ? "en" : "vi";
}
