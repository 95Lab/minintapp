"use client";
// Templates and the homepage share the same brief review before generation.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Lifetime } from "@/engine/api/api-contract-types";
import { HERO_PROMPTS, t, type UiLocale } from "@/engine/i18n/ui-strings-vi-en";
import { BoltIcon } from "@/engine-ui/brand-top-bar";
import { PlanningChat } from "@/components/create/planning-chat";
import { CreationAvailabilityNotice, useCreationAvailability, requireCreationAvailability } from "@/components/create/creation-availability";
import { creationBlocked } from "@/lib/api/creation-availability";
import { ApiClientError, requestJson, awaitProvisioned } from "@/lib/api/api-client";
import type { GenerateRequest, GenerateResponse } from "@/lib/api/api-contract-types";

const MAX = 500;

export function PromptComposer({
  locale,
  initialPrompt,
  lifetime,
  onLifetimeChange: setLifetime,
}: {
  locale: UiLocale;
  initialPrompt: string;
  lifetime: Lifetime;
  onLifetimeChange: (l: Lifetime) => void;
}) {
  const s = t(locale);
  const router = useRouter();
  const [prompt, setPrompt] = useState(initialPrompt);
  const availability = useCreationAvailability();
  const [busy, setBusy] = useState(false);
  const [idea, setIdea] = useState("");
  const [open, setOpen] = useState(false);
  const launchButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (!open && idea) launchButton.current?.focus(); }, [open, idea]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || busy) return;
    setBusy(true);
    const allowed = await availability.refresh();
    setBusy(false);
    if (allowed) { setIdea(prompt.trim()); setOpen(true); }
  }
  async function generate(input: GenerateRequest) {
    await requireCreationAvailability(locale);
    await requestJson("/api/session", { method: "POST" });
    const result = await awaitProvisioned(await requestJson<GenerateResponse>("/api/engine/generate", {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify(input),
    }, 310_000));
    if (!result.ok) throw new ApiClientError(400, result.message);
    if (!/^[a-f0-9]{24}$/.test(result.id)) throw new Error("Invalid app ID");
    router.push(`/rooms/${result.id}/host`);
  }

  const lifetimes: Array<[Lifetime, string]> = [
    ["1h", s.lifetime1h],
    ["24h", s.lifetime24h],
    ["7d", s.lifetime7d],
  ];

  return (
    <>
    <CreationAvailabilityNotice {...availability} locale={locale} />
    <form className="card composer" onSubmit={submit}>
      <div className="field">
        <label htmlFor="prompt">{s.composerLabel}</label>
        <textarea
          id="prompt"
          className="textarea"
          value={prompt}
          maxLength={MAX}
          placeholder={s.composerPlaceholder}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e);
          }}
          disabled={busy}
          rows={4}
        />
      </div>
      <div className="chips" aria-label={s.tryExamples}>
        <span className="muted" style={{ fontSize: 14 }}>{s.tryExamples}:</span>
        {HERO_PROMPTS[locale].map((h) => (
          <button key={h.label} type="button" className="chip" onClick={() => setPrompt(h.prompt)} disabled={busy}>
            {h.label}
          </button>
        ))}
      </div>
      <div className="composer-row">
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span className="muted" style={{ fontSize: 14 }}>{s.lifetime}</span>
          <div className="segmented" role="group" aria-label={s.lifetime}>
            {lifetimes.map(([v, label]) => (
              <button key={v} type="button" aria-pressed={lifetime === v} onClick={() => setLifetime(v)} disabled={busy}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="muted num" style={{ fontSize: 13 }}>{s.charCount(prompt.length, MAX)}</span>
          <button ref={launchButton} className="btn btn-bolt btn-lg" type="submit" disabled={busy || !prompt.trim() || !!availability.availability && creationBlocked(availability.availability)}>
            <BoltIcon /> {locale === "vi" ? "Trao đổi ý tưởng" : "Discuss your idea"}
          </button>
        </div>
      </div>
      <p className="muted">{locale === "vi" ? "Chat cùng AI để làm rõ ý tưởng. Chốt yêu cầu rồi mới tạo app." : "Chat with AI to shape your idea. Confirm the brief before creating."}</p>
    </form>
    {idea && <PlanningChat key={idea} open={open} initialPrompt={idea} initialLifetime={lifetime} onLifetimeChange={setLifetime} locale={locale} onClose={() => setOpen(false)} onGenerate={generate} />}
    </>
  );
}
