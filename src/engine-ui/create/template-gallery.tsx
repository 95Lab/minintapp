"use client";
import {useLocale} from "@/lib/i18n/locale-provider";
import {localizeRecord,toJapanese} from "@/lib/i18n/japanese";
// Ready-made templates create without AI, then wait for deployment before opening the host view,
// where it can be remixed in words.
import { CreationAvailabilityNotice, useCreationAvailability } from "@/components/create/creation-availability";
import { creationBlocked } from "@/lib/api/creation-availability";
import { useRef, useState } from "react";
import styles from "./template-gallery.module.css";
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
  const {localize,language}=useLocale();
  const s = language==="ja"?localizeRecord(t("en")):t(locale);
  const [query,setQuery]=useState("");
  const [price,setPrice]=useState("all");
  const normalize=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").toLowerCase();
  const catalog=APP_TEMPLATES.map((tpl,index)=>({tpl,paid:index%4===3,views:240+index*73,clones:18+index*11}));
  const visible=catalog.filter(({tpl,paid})=>(price==="all"||(price==="paid")===paid)&&normalize(`${localize(tpl.title.vi,tpl.title.en)} ${localize(tpl.blurb.vi,tpl.blurb.en)}`).includes(normalize(query.trim())));
  const availability = useCreationAvailability();
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);

  async function open(templateId: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusyId(templateId);
    setError(null);
    let navigating = false;
    try {
      if (!await availability.refresh()) {
        setError(localize("Chưa thể tạo app. Kiểm tra lại hạn mức ở đầu danh sách.","Cannot create the app yet. Check your app limit above the list."));
        return;
      }
      const res = await createFromTemplate({ templateId, locale, lifetime });
      if (!res.ok) {
        setError(errorText(res.code, locale, res.params));
        return;
      }
      setHostToken(res.id, res.hostToken);
      router.push(`/rooms/${res.id}/host`);
      navigating = true;
    } catch {
      setError(errorText("network", locale));
    } finally {
      if (!navigating) { setBusyId(null); inFlight.current = false; }
    }
  }

  return (
    <section aria-labelledby="templates-title" style={{ display: "grid", gap: 12 }}>
      <div>
        <h2 id="templates-title" style={{ fontSize: 20 }}>{s.templatesTitle}</h2>
        <p className="muted" style={{ margin: "4px 0 0" }}>{s.templatesHint}</p>
      </div>
      <div className="catalog-filters"><label>{localize("Tìm mẫu ứng dụng","Search app templates")}<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder={localize("Tên mẫu hoặc nhu cầu…","Template name or need…")}/></label><label>{localize("Loại mẫu","Template pricing")}<select value={price} onChange={e=>setPrice(e.target.value)}><option value="all">{localize("Tất cả","All")}</option><option value="free">Free</option><option value="paid">Paid</option></select></label></div>
      <p className="catalog-note">{localize("Demo marketplace: nhãn Free/Paid và lượt xem/clone là dữ liệu giả lập. Mọi mẫu đều dùng thử miễn phí, chưa thu phí.","Marketplace demo: Free/Paid labels and view/clone counts are simulated. All templates are free to try; no payments.")}</p>
      <p className="catalog-note" role="status">{locale==="vi"?`${visible.length} mẫu phù hợp`:(language==="ja"?toJapanese(`${visible.length} matching templates`):`${visible.length} matching templates`)}</p>
      <CreationAvailabilityNotice {...availability} locale={locale} />
      <div className="template-grid">
        {visible.map(({tpl,paid,views,clones}) => (
          <button key={tpl.id} type="button" className="card template-card" data-app-theme={tpl.spec[locale].theme} onClick={() => open(tpl.id)} disabled={!!busyId || !!availability.availability && creationBlocked(availability.availability)}>
            <span className="template-kind">{localize(KIND_LABEL[tpl.kind as VocabularyType]?.vi??tpl.kind,KIND_LABEL[tpl.kind as VocabularyType]?.en??tpl.kind)}</span>
            <span className="catalog-price" data-paid={paid}>{paid?"Paid · "+(localize("Có phí","Paid template")):"Free · "+(localize("Miễn phí","Free template"))}</span>
            <strong>{localize(tpl.title.vi,tpl.title.en)}</strong>
            <span className="muted" style={{ fontSize: 14 }}>{busyId === tpl.id ? s.usingTemplate : localize(tpl.blurb.vi,tpl.blurb.en)}</span>
            <span className="catalog-metrics">{views.toLocaleString(locale)} {localize("lượt xem","views")} · {clones.toLocaleString(locale)} {localize("lượt clone","clones")} <span>(demo)</span></span>
          </button>
        ))}
      </div>
      {visible.length===0&&<p className="catalog-empty">{localize("Không có mẫu phù hợp. Thử từ khóa khác hoặc chọn tất cả loại mẫu.","No matching templates. Try another search or select all pricing types.")}</p>}
      {busyId && <div className={styles.feedback} role="status" aria-live="polite">
        <strong>{localize("Đang tạo ứng dụng","Creating your app")}: {APP_TEMPLATES.find(tpl => tpl.id === busyId)?.title[locale]}</strong>
        <p>{localize("Đang chuẩn bị ứng dụng. Bước này có thể mất vài phút; trang sẽ tự mở khi sẵn sàng.","Preparing your app. This may take a few minutes; it will open automatically when ready.")}</p>
      </div>}
      {error && <div className={styles.feedback} role="alert">
        <strong>{localize("Chưa mở được ứng dụng","Could not open the app")}</strong>
        <p>{error}</p>
        <a href="/dashboard">{localize("Mở Ứng dụng của tôi","Open My apps")}</a>
        <button type="button" onClick={() => setError(null)}>{localize("Đóng thông báo","Dismiss")}</button>
      </div>}
    </section>
  );
}
