"use client";
// Home: thesis headline, the composer, and the six-step lifecycle strip. VI/EN toggle
// switches the chrome and the example prompts.
import { useEffect, useState } from "react";
import { BrandTopBar } from "@/engine-ui/brand-top-bar";
import { t, type UiLocale } from "@/engine/i18n/ui-strings-vi-en";
import { IntegrationStatusBadge } from "@/engine-ui/integration-status-badge";
import type { Lifetime } from "@/engine/api/api-contract-types";
import { PromptComposer } from "./prompt-composer";
import { TemplateGallery } from "./template-gallery";

const STEPS: Record<UiLocale, Array<[string, string]>> = {
  vi: [
    ["Describe", "Gõ nhu cầu bằng tiếng Việt hoặc Anh"],
    ["Generate", "Codex dựng app từ khối tin cậy"],
    ["Run", "Màn chiếu cho host, màn điện thoại cho mọi người"],
    ["Share", "QR + link, không cài, không đăng nhập"],
    ["Remix", "Đổi app bằng lời, điện thoại tự chuyển"],
    ["Expire", "Hết giờ là tự huỷ, dữ liệu xoá"],
  ],
  en: [
    ["Describe", "Say what you need in Vietnamese or English"],
    ["Generate", "Codex builds it from trusted blocks"],
    ["Run", "Projector view for you, phone view for everyone"],
    ["Share", "QR + link, no install, no sign-in"],
    ["Remix", "Change it in words, phones follow"],
    ["Expire", "Time's up, it self-destructs"],
  ],
};

export function HomeScreen({ initialPrompt }: { initialPrompt: string }) {
  const [locale, setLocale] = useState<UiLocale>("vi");
  const [lifetime, setLifetime] = useState<Lifetime>("1h");
  useEffect(() => {
    try {
      // Demo laptop: open /?pk=<PRESENTER_KEY> once; the key is kept locally and removed from the URL.
      const pk = new URLSearchParams(window.location.search).get("pk");
      if (pk) {
        localStorage.setItem("minint:presenter", pk);
        const url = new URL(window.location.href);
        url.searchParams.delete("pk");
        history.replaceState(null, "", url.pathname + url.search);
      }
      const saved = localStorage.getItem("minint:ui-locale");
      if (saved === "vi" || saved === "en") setLocale(saved);
    } catch {
      /* default vi */
    }
  }, []);
  function choose(l: UiLocale) {
    setLocale(l);
    try {
      localStorage.setItem("minint:ui-locale", l);
    } catch {
      /* ignore */
    }
  }
  const s = t(locale);
  return (
    <>
      <BrandTopBar>
        <IntegrationStatusBadge />
        <div className="segmented" role="group" aria-label="Language">
          <button type="button" aria-pressed={locale === "vi"} onClick={() => choose("vi")}>VI</button>
          <button type="button" aria-pressed={locale === "en"} onClick={() => choose("en")}>EN</button>
        </div>
      </BrandTopBar>
      <main className="home">
        <section className="home-hero">
          <h1>
            {locale === "vi" ? (
              <>Mô tả nhu cầu. <em>Nhận ngay</em> một mini-app đang chạy.</>
            ) : (
              <>Describe a need. <em>Get</em> a running mini-app.</>
            )}
          </h1>
          <p>{s.subTagline}</p>
        </section>
        <PromptComposer locale={locale} initialPrompt={initialPrompt} lifetime={lifetime} onLifetimeChange={setLifetime} />
        <TemplateGallery locale={locale} lifetime={lifetime} />
        <section aria-label={s.howTitle}>
          <div className="how">
            {STEPS[locale].map(([title, text]) => (
              <div key={title}>
                <b>{title}</b>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
