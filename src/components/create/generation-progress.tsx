import type { GenerateEvent } from "@/lib/api/api-contract-types";
export function GenerationProgress({ event }: { event: GenerateEvent | null }) {
  if (!event) return null;
  const label = event.stage === "thinking" ? "Đang phân tích yêu cầu…" : event.stage === "validating" ? "Đang kiểm tra ứng dụng…" : event.stage === "done" ? "Ứng dụng đã sẵn sàng." : "message" in event ? event.message : "Đang xử lý…";
  return <p role={event.stage === "error" ? "alert" : "status"} aria-live="polite">{label}</p>;
}
