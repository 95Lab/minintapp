"use client";
// Remix in words. On success the host jumps to the child app; participants follow the
// server-side movedTo pointer on their next state refresh.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { remixApp } from "@/engine/api/api-client";
import { setHostToken } from "@/engine/host/host-token-store";
import { t, type UiLocale } from "@/engine/i18n/ui-strings-vi-en";
import { BoltIcon } from "@/engine-ui/brand-top-bar";
import type { PublicBlock } from "@/engine/app-spec/strip-private-fields";
import { remixSuggestions } from "./remix-suggestions-by-block";
import { errorText } from "@/engine/api/app-error-codes";

export function RemixPanel({ appId, hostToken, locale, disabled, firstBlock }: { appId: string; hostToken: string | null; locale: UiLocale; disabled: boolean; firstBlock: PublicBlock | undefined }) {
  const s = t(locale);
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function go(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setProblem(null);
    const res = await remixApp(appId, hostToken, text.trim()).catch(() => null);
    if (res?.ok) {
      setHostToken(res.newId, res.hostToken);
      router.push(`/rooms/${res.newId}/host`);
      return;
    }
    setBusy(false);
    setProblem(res ? [errorText(res.code, locale, res.params), res.suggestion].filter(Boolean).join(" ") : s.offline);
  }

  return (
    <form className="card remix" onSubmit={go}>
      <label htmlFor="remix" className="panel-title" style={{ marginBottom: 0 }}>{s.remixLabel}</label>
      <div className="remix-row">
        <input id="remix" className="input" value={text} maxLength={300} placeholder={s.remixPlaceholder} onChange={(e) => setText(e.target.value)} disabled={busy || disabled} />
        <button className="btn btn-bolt" type="submit" disabled={busy || disabled || !text.trim()}>
          <BoltIcon /> {busy ? s.remixing : s.remixGo}
        </button>
      </div>
      <div className="chips">
        {remixSuggestions(firstBlock, locale).map((sug) => (
          <button key={sug} type="button" className="chip" onClick={() => setText(sug)} disabled={busy || disabled}>
            {sug}
          </button>
        ))}
      </div>
      <span className="muted" style={{ fontSize: 13 }}>{s.remixHint}</span>
      {problem && <div className="notice warn" role="alert">{problem}</div>}
    </form>
  );
}
