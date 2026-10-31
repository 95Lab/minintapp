"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CreationAvailabilitySchema, creationBlocked, type CreationAvailability } from "@/lib/api/creation-availability";
import { errorText } from "@/engine/api/app-error-codes";
import { ApiClientError, requestJson } from "@/lib/api/api-client";

export async function checkCreationAvailability() {
  return CreationAvailabilitySchema.parse(await requestJson("/api/creation-availability", { cache: "no-store" }));
}
export async function requireCreationAvailability(locale: "vi" | "en") {
  let next: CreationAvailability;
  try { next = await checkCreationAvailability(); }
  catch { throw new ApiClientError(503, locale === "vi" ? "Chưa kiểm tra được hạn mức. Vui lòng thử lại." : "Could not check your app limit. Please retry."); }
  if (creationBlocked(next)) throw new ApiClientError(409, errorText("owner_app_limit", locale), "owner_app_limit");
}
export function useCreationAvailability() {
  const [availability, setAvailability] = useState<CreationAvailability | null>(null);
  const [error, setError] = useState(false);
  const refresh = useCallback(async () => {
    try { const next = await checkCreationAvailability(); setAvailability(next); setError(false); return !creationBlocked(next); }
    catch { setError(true); return false; }
  }, []);
  useEffect(() => { void refresh(); window.addEventListener("focus", refresh); return () => window.removeEventListener("focus", refresh); }, [refresh]);
  return { availability, error, refresh };
}
export function CreationAvailabilityNotice({ availability, error, refresh, locale }: ReturnType<typeof useCreationAvailability> & { locale: "vi" | "en" }) {
  if (!error && availability?.limit === null) return null;
  const vi = locale === "vi";
  return <div className="mini-notice" role="status">
    {error ? (vi ? "Chưa kiểm tra được hạn mức. Hãy thử lại trước khi tạo." : "Could not check your app limit. Retry before creating.") : !availability ? (vi ? "Đang kiểm tra hạn mức…" : "Checking app limit…") : (vi ? `Đang dùng ${availability.used}/${availability.limit} chỗ ứng dụng.` : `Using ${availability.used}/${availability.limit} app slots.`)}
    {availability && creationBlocked(availability) && <p>{vi ? "Chọn “Kết thúc và xóa” ở Ứng dụng của tôi, rồi chờ dọn dẹp hoàn tất. Tạm dừng không giải phóng chỗ." : "Choose “End and delete” in My apps, then wait for cleanup. Pausing does not free a slot."} <Link href="/dashboard">{vi ? "Mở Ứng dụng của tôi" : "Open My apps"}</Link></p>}
    {(error || availability && creationBlocked(availability)) && <button type="button" onClick={() => void refresh()}>{vi ? "Kiểm tra lại hạn mức" : "Check limit again"}</button>}
  </div>;
}
