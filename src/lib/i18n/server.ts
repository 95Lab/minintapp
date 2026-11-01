import "server-only";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, resolveLocale, resolveLanguage } from "./locale";
export async function getLocale() {
  return resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value);
}

export async function getLanguage(){return resolveLanguage((await cookies()).get(LOCALE_COOKIE)?.value);}
