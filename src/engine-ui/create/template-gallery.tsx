"use client";
// Ready-made templates: one tap creates the app instantly (no AI call) and opens the host view,
// where it can be remixed in words.
import { CreationAvailabilityNotice, useCreationAvailability } from "@/components/create/creation-availability";
import { creationBlocked } from "@/lib/api/creation-availability";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Lifetime } from "@/engine/api/api-contract-types";
import { createFromTemplate } from "@/engine/api/api-client";
import { setHostToken } from "@/engine/host/host-token-store";
import { t, type UiLocale } from "@/engine/i18n/ui-strings-vi-en";
import { APP_TEMPLATES } from "@/engine/templates/app-templates";

import type { VocabularyType } from "@/engine/app-spec/app-spec-schema";
import { errorText } from "@/engine/api/app-error-codes";

// Keyed by every brick/preset name so a new one can't ship without a gallery tag.
const KIND_LABEL: Record<VocabularyType, { vi: string; en: string }> = {
  choice: { vi: "Bình chọn", en: "Poll" },
  quiz: { vi: "Quiz", en: "Quiz" },
  collect: { vi: "Form", en: "Form" },
  wheel: { vi: "Vòng quay", en: "Wheel" },
  open_text: { vi: "Word cloud", en: "Word cloud" },
  compose: { vi: "Lắp ghép", en: "Composed" },
  custom: { vi: "Mini game", en: "Mini game" },
  live: { vi: "Dữ liệu trực tiếp", en: "Live data" },
};

export function TemplateGallery({ locale, lifetime }: { locale: UiLocale; lifetime: Lifetime }) {
  const s = t(locale);
  const availability = useCreationAvailability();
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function open(templateId: string) {
    if (busyId) return;
    setBusyId(templateId);
    setError(null);
    if (!await availability.refresh()) { setBusyId(null); return; }
    const res = await createFromTemplate({ templateId, locale, lifetime });
    if (res.ok) {
      setHostToken(res.id, res.hostToken);
      router.push(`/rooms/${res.id}/host`);
      return;
    }
    setError(errorText(res.code, locale, res.params));
    setBusyId(null);
  }

  return (
    <section aria-labelledby="templates-title" style={{ display: "grid", gap: 12 }}>
      <div>
        <h2 id="templates-title" style={{ fontSize: 20 }}>{s.templatesTitle}</h2>
        <p className="muted" style={{ margin: "4px 0 0" }}>{s.templatesHint}</p>
      </div>
      <CreationAvailabilityNotice {...availability} locale={locale} />
      <div className="template-grid">
        {APP_TEMPLATES.map((tpl) => (
          <button key={tpl.id} type="button" className="card template-card" data-app-theme={tpl.spec[locale].theme} onClick={() => open(tpl.id)} disabled={!!busyId || !!availability.availability && creationBlocked(availability.availability)}>
            <span className="template-kind">{KIND_LABEL[tpl.kind as VocabularyType]?.[locale] ?? tpl.kind}</span>
            <strong>{tpl.title[locale]}</strong>
            <span className="muted" style={{ fontSize: 14 }}>{busyId === tpl.id ? s.usingTemplate : tpl.blurb[locale]}</span>
          </button>
        ))}
      </div>
      {error && <div className="notice warn" role="alert">{error} <a href="/dashboard">{locale === "vi" ? "Mở Ứng dụng của tôi" : "Open My apps"}</a></div>}
    </section>
  );
}
