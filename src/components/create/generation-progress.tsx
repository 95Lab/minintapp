"use client";
import { translate } from "@/lib/i18n/messages";
import { useLocale } from "@/lib/i18n/locale-provider";
import type { GenerateEvent } from "@/lib/api/api-contract-types";
export function GenerationProgress({ event }: { event: GenerateEvent | null }) {
  const { locale } = useLocale();
  const tr = (message: Parameters<typeof translate>[1]) => translate(locale, message);
  if (!event) return null;
  const label = event.stage === "thinking" ? tr("Đang phân tích yêu cầu…") : event.stage === "validating" ? tr("Đang kiểm tra ứng dụng…") : event.stage === "done" ? tr("Ứng dụng đã sẵn sàng.") : "message" in event ? event.message : tr("Đang xử lý…");
  return <p role={event.stage === "error" ? "alert" : "status"} aria-live="polite">{label}</p>;
}
