"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiClientError, createPoll } from "@/lib/api/api-client";
export function CreatePollButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <div><button disabled={busy} onClick={async () => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const result = await createPoll();
      if (!result.ok) { setError(result.message); setBusy(false); return; }
      router.push(`/a/${result.id}/host`);
    } catch (error) { setError(error instanceof ApiClientError ? error.message : "Không thể tạo bình chọn. Vui lòng thử lại."); setBusy(false); }
  }}>{busy ? "Đang tạo…" : "Tạo bình chọn mẫu"}</button>{error && <p role="alert">{error}</p>}</div>;
}
