"use client";
import { useRuntimeTranslation } from "@/lib/i18n/runtime-locale";
export function AnnouncementBanner({ announcement }: { announcement: { text: string; at: number } | null }) {
  const tr = useRuntimeTranslation();
  return announcement ? <aside className="mini-notice" aria-label={tr("Thông báo từ host")}><strong>{tr("Thông báo")}</strong><p>{announcement.text}</p></aside> : null;
}
