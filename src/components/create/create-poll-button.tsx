"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiClientError, createFromTemplate } from "@/lib/api/api-client";
export function CreatePollButton({ templateId = "poll-drinks", label = "Tạo bình chọn mẫu" }: { templateId?: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <div><button disabled={busy} onClick={async () => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const result = await createFromTemplate(templateId);
      if (!result.ok) { setError(result.message); setBusy(false); return; }
      router.push(`/a/${result.id}/host`);
    } catch (error) { setError(error instanceof ApiClientError ? error.message : "Không thể tạo ứng dụng. Vui lòng thử lại."); setBusy(false); }
  }}>{busy ? "Đang tạo…" : label}</button>{error && <p role="alert">{error}</p>}</div>;
}
