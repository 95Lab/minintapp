// The few words the server writes INTO results (they end up inside names and table cells that are
// computed once for everyone): the stand-in for a participant with no name, and the waitlist mark.
// Picked by the app's language, like everything else the room reads.
import type { Locale } from "@/engine/app-spec/app-spec-schema";

const LABELS = {
  vi: { anonymous: "Ẩn danh", waitlisted: "chờ", numberLocale: "vi-VN" },
  en: { anonymous: "Anonymous", waitlisted: "waitlist", numberLocale: "en-US" },
} as const satisfies Record<Locale, Record<string, string>>;

export type ResultLabels = (typeof LABELS)[Locale];

export const resultLabels = (locale: Locale | undefined): ResultLabels => LABELS[locale ?? "vi"];
