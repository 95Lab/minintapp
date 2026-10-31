"use client";
// Describe step: prompt box, hero example chips, lifetime picker, streamed generation progress.
// On success the host token is stored and the host lands on the projector view.
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Lifetime } from "@/engine/api/api-contract-types";
import { generateApp } from "@/engine/api/api-client";
import { setHostToken } from "@/engine/host/host-token-store";
import { HERO_PROMPTS, t, type UiLocale } from "@/engine/i18n/ui-strings-vi-en";
import { BoltIcon } from "@/engine-ui/brand-top-bar";
import { GenerationProgress, type GenStage } from "./generation-progress";
import { errorText } from "@/engine/api/app-error-codes";

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
  const [stage, setStage] = useState<GenStage>("idle");
  const [problem, setProblem] = useState<{ tone: "warn" | "danger"; message: string; suggestion: string | null } | null>(null);
  const busy = stage !== "idle";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || busy) return;
    setProblem(null);
    setStage("thinking");
    let finished = false;
    await generateApp({ prompt: prompt.trim(), lifetime }, (ev) => {
      if (ev.stage === "thinking" || ev.stage === "validating") setStage(ev.stage);
      else if (ev.stage === "done") {
        finished = true;
        setStage("done");
        setHostToken(ev.id, ev.hostToken);
        router.push(`/rooms/${ev.id}/host`);
      } else if ("message" in ev) {
        finished = true;
        setStage("idle");
        const tone = ev.stage === "refused" ? "danger" : "warn";
        const fallback = ev.stage === "refused" ? "generate_refused" : ev.stage === "unsupported" ? "generate_unsupported" : "generate_failed";
        const message = errorText(ev.code ?? fallback, locale, "params" in ev ? ev.params : undefined);
        setProblem({ tone, message, suggestion: "suggestion" in ev ? ev.suggestion : null });
      }
    }).catch(() => setProblem({ tone: "warn", message: s.offline, suggestion: null }));
    if (!finished) setStage("idle");
  }

  const lifetimes: Array<[Lifetime, string]> = [
    ["1h", s.lifetime1h],
    ["24h", s.lifetime24h],
    ["7d", s.lifetime7d],
  ];

  return (
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
          <button className="btn btn-bolt btn-lg" type="submit" disabled={busy || !prompt.trim()}>
            <BoltIcon /> {busy ? s.creating : s.create}
          </button>
        </div>
      </div>
      {busy && <GenerationProgress stage={stage} locale={locale} />}
      {problem && (
        <div className={`notice ${problem.tone}`} role="alert">
          <strong>{problem.message}</strong>
          {problem.suggestion && <div style={{ marginTop: 4 }}>{problem.suggestion}</div>}
        </div>
      )}
    </form>
  );
}
