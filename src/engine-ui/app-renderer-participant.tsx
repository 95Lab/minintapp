"use client";
// Participant (phone) screen opened from the QR. Anonymous token per app, optional display
// name, fixed safety banner + report button. Follows movedTo automatically after a remix.
import { useEffect, useState } from "react";
import type { ResponsePayload } from "@/engine/api/api-contract-types";
import { reportApp, submitResponse, uploadPhoto } from "@/engine/api/api-client";
import { getDisplayName, getParticipantToken, setDisplayName } from "@/engine/participant/participant-token";
import { useAppState } from "@/engine/realtime/use-app-state";
import { t } from "@/engine/i18n/ui-strings-vi-en";
import { blockUi } from "@/engine-ui/blocks/block-ui-registry";
import { ExpiredNotice } from "@/engine-ui/lifecycle/expired-notice";
import { ExpiryCountdown } from "@/engine-ui/lifecycle/expiry-countdown";
import { errorText } from "@/engine/api/app-error-codes";
import { AnnouncementBanner } from "@/engine-ui/announcement-banner";
import { AppPagesTabs, blocksWithOpenStep } from "@/engine-ui/app-pages-tabs";

export function AppRendererParticipant({ appId }: { appId: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    setToken(getParticipantToken(appId));
    const n = getDisplayName();
    setName(n);
    setNameDraft(n);
  }, [appId]);

  const { state, gone, offline, apply } = useAppState(appId, { participant: token }, { intervalMs: 1500, followMove: true, enabled: !!token, audience: "participant" });

  if (gone) return <ExpiredNotice gone={gone} />;
  if (!state || !token) return <main className="p-wrap"><p className="muted">…</p></main>;

  const locale = state.spec.locale;
  const s = t(locale);
  const open = state.status === "active";
  const needsName = state.spec.requireName && !name;

  async function send(blockId: string, itemId: string, payload: ResponsePayload) {
    setError(null);
    const r = await submitResponse(appId, { blockId, itemId, participantToken: token!, displayName: name || null, payload });
    if (r.kind === "ok") {
      apply(r.state);
      return true;
    }
    setError(r.kind === "error" ? errorText(r.code, locale, r.params) : s.closedNotice);
    return false;
  }

  const tabbed = state.spec.layout === "tabs" && state.spec.blocks.length > 1;

  const renderBlock = (block: (typeof state.spec.blocks)[number], i: number) => {
    const { Participant } = blockUi(block.type);
    const r = state.results[i];
    return (
      <Participant
        key={block.id}
        block={block}
        results={r?.type === block.type ? r : null}
        runtime={state.runtime}
        myAnswers={state.myAnswers}
        open={open}
        locale={locale}
        appId={appId}
        displayName={name}
        payee={state.payee}
        appTitle={state.spec.title}
        onSubmit={(itemId, p) => send(block.id, itemId, p)}
        onUpload={(photo) => uploadPhoto(appId, block.id, token, photo)}
      />
    );
  };

  return (
    <div data-app-theme={state.spec.theme}>
      <div className="p-accent" />
      <main className="p-wrap">
        <header className="p-head">
          <div className="host-meta">
            <ExpiryCountdown expiresAt={state.expiresAt} label={s.expiresIn} />
            {offline && <span className="pill">{s.offline}</span>}
          </div>
          <h1>{state.spec.title}</h1>
          {state.spec.description && <p className="muted" style={{ margin: 0 }}>{state.spec.description}</p>}
        </header>

        <AnnouncementBanner appId={appId} announcement={state.announcement} locale={locale} />
        {!open && <div className="notice warn">{s.closedNotice}</div>}
        {error && <div className="notice danger" role="alert">{error}</div>}

        {needsName ? (
          <form
            className="card p-card"
            onSubmit={(e) => {
              e.preventDefault();
              if (!nameDraft.trim()) return;
              setDisplayName(nameDraft);
              setName(nameDraft.trim().slice(0, 40));
            }}
          >
            <div className="field">
              <label htmlFor="display-name">{s.yourName}</label>
              <input id="display-name" className="input" maxLength={40} autoComplete="nickname" value={nameDraft} placeholder={s.yourNamePlaceholder} onChange={(e) => setNameDraft(e.target.value)} />
            </div>
            <button className="btn btn-app btn-lg" type="submit" disabled={!nameDraft.trim()}>{s.continue}</button>
          </form>
        ) : (
          tabbed ? (
            <AppPagesTabs blocks={state.spec.blocks} badgeIds={blocksWithOpenStep(state.spec.blocks, state.runtime)} render={renderBlock} />
          ) : (
            state.spec.blocks.map(renderBlock)
          )
        )}
      </main>

      <div className="safety" role="note">
        <span>{s.safetyBanner}</span>
        <button
          type="button"
          disabled={reported}
          onClick={async () => {
            await reportApp(appId, token);
            setReported(true);
          }}
        >
          {reported ? s.reported : s.report}
        </button>
      </div>
    </div>
  );
}
