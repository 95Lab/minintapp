import "server-only";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, resolveLocale } from "./locale";
export async function getLocale() {
  return resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value);
}
