"use client";
import { translate } from "@/lib/i18n/messages";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiClientError, createFromTemplate } from "@/lib/api/api-client";
export function CreatePollButton({ templateId = "poll-drinks", label }: { templateId?: string; label?: string }) {
  const { locale } = useLocale();
  const tr = (message: Parameters<typeof translate>[1]) => translate(locale, message);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <div><button disabled={busy} onClick={async () => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const result = await createFromTemplate(templateId, locale);
      if (!result.ok) { setError(result.message); setBusy(false); return; }
      router.push(`/a/${result.id}/host`);
    } catch (error) { setError(error instanceof ApiClientError ? error.message : tr("Không thể tạo ứng dụng. Vui lòng thử lại.")); setBusy(false); }
  }}>{busy ? tr("Đang tạo…") : label ?? tr("Tạo bình chọn mẫu")}<span className="template-arrow" aria-hidden="true">↗</span></button>{error && <p role="alert">{error}</p>}</div>;
}
