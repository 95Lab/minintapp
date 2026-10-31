"use client";
// Host (projector) screen: live results for each block, QR share panel, lifecycle controls,
// and remix. Without the host token the page degrades to a read-only view.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { downloadExport, postHost } from "@/engine/api/api-client";
import { captureHostTokenFromHash } from "@/engine/host/host-token-store";
import { useAppState } from "@/engine/realtime/use-app-state";
import { t } from "@/engine/i18n/ui-strings-vi-en";
import { BrandTopBar } from "@/engine-ui/brand-top-bar";
import { IntegrationStatusBadge, useHealth } from "@/engine-ui/integration-status-badge";
import { blockUi } from "@/engine-ui/blocks/block-ui-registry";
import { SharePanelQr } from "@/engine-ui/share/share-panel-qr";
import { RemixPanel } from "@/engine-ui/remix/remix-panel";
import { ExpiryCountdown } from "@/engine-ui/lifecycle/expiry-countdown";
import { ExpiredNotice } from "@/engine-ui/lifecycle/expired-notice";
import { errorText } from "@/engine/api/app-error-codes";
import { AnnouncementBanner } from "@/engine-ui/announcement-banner";
import { PayeeForm } from "@/engine-ui/payee-form";
import { AppPagesTabs, blocksWithOpenStep } from "@/engine-ui/app-pages-tabs";

export function AppRendererHost({ appId }: { appId: string }) {
  const router = useRouter();
  const [hostToken, setHostTokenState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [announceDraft, setAnnounceDraft] = useState("");

  useEffect(() => {
    setHostTokenState(captureHostTokenFromHash(appId));
    setReady(true);
  }, [appId]);

  const health = useHealth();
  const { state, gone, offline, refresh } = useAppState(appId, { host: hostToken }, { intervalMs: 1000, followMove: false, enabled: ready, audience: "host" });

  // A host that remixed on another device follows the child app too (only if it holds that token).
  useEffect(() => {
    if (state?.movedTo && state.isHost) router.replace(`/rooms/${state.movedTo}/host`);
  }, [state?.movedTo, state?.isHost, router]);

  if (gone) return <><BrandTopBar /><ExpiredNotice gone={gone} /></>;
  if (!state) return <><BrandTopBar /><main className="host"><p className="muted">…</p></main></>;

  const locale = state.spec.locale;
  const s = t(locale);
  // The server decides: the host token, or the signed-in owner's session (no token needed on this device).
  const canControl = state.isHost;
  const active = state.status === "active";

  async function run(path: "block-action" | "lifecycle" | "simulate", body?: Parameters<typeof postHost>[3]) {
    setBusy(true);
    setMessage(null);
    const res = await postHost(appId, path, hostToken, body);
    if (!res.ok) setMessage(errorText(res.code, locale, res.params));
    await refresh();
    setBusy(false);
  }

  const tabbed = state.spec.layout === "tabs" && state.spec.blocks.length > 1;

  const renderBlock = (block: (typeof state.spec.blocks)[number], i: number) => {
    const { Host } = blockUi(block.type);
    const r = state.results[i];
    return (
      <Host
        key={block.id}
        block={block}
        results={r?.type === block.type ? r : null}
        runtime={state.runtime}
        locale={locale}
        appId={appId}
        payee={state.payee}
        appTitle={state.spec.title}
        busy={busy || !active}
        canControl={canControl && active}
        canSettle={canControl}
        onAction={(action, args) => run("block-action", { blockId: block.id, action, args })}
      />
    );
  };

  return (
    <div data-app-theme={state.spec.theme}>
      <BrandTopBar>
        {offline && <span className="pill">{s.offline}</span>}
        <IntegrationStatusBadge />
      </BrandTopBar>
      <main className="host">
        <div className="host-head">
          <div style={{ display: "grid", gap: 8 }}>
            <div className="host-meta">
              <span className={`pill ${active ? "live" : ""}`}>{active ? s.hostLive : s.hostClosed}</span>
              <ExpiryCountdown expiresAt={state.expiresAt} label={s.expiresIn} />
            </div>
            <h1>{state.spec.title}</h1>
            {state.spec.description && <p className="muted" style={{ margin: 0, fontSize: 18 }}>{state.spec.description}</p>}
          </div>
          {canControl && (
            <div className="toolbar">
              {health?.simulate && (
                <button className="btn" onClick={() => run("simulate")} disabled={busy || !active} title={s.simulateNote}>
                  {s.simulate}
                </button>
              )}
              {active && (
                <button className="btn" onClick={() => run("lifecycle", { action: "close" })} disabled={busy}>
                  {s.closeVoting}
                </button>
              )}
              {state.status === "closed" && !state.movedTo && (
                <button className="btn" onClick={() => run("lifecycle", { action: "reopen" })} disabled={busy}>
                  {s.reopen}
                </button>
              )}
              {/* Keep it as long as you want: push the expiry later */}
              <select
                className="btn"
                aria-label={s.extendLabel}
                value=""
                disabled={busy}
                onChange={(e) => {
                  const by = e.target.value as "1h" | "24h" | "7d";
                  if (by) void run("lifecycle", { action: "extend", by });
                }}
              >
                <option value="">{s.extendLabel}</option>
                <option value="1h">{s.extendBy1h}</option>
                <option value="24h">{s.extendBy24h}</option>
                <option value="7d">{s.extendBy7d}</option>
              </select>
              <button
                className="btn"
                disabled={busy}
                onClick={async () => {
                  setMessage(null);
                  const res = await downloadExport(appId, hostToken);
                  if (!res.ok) setMessage(errorText(res.code, locale, res.params));
                }}
              >
                {s.exportCsv}
              </button>
              <button className="btn btn-danger" onClick={() => setConfirmEnd(true)} disabled={busy}>
                {s.endNow}
              </button>
            </div>
          )}
        </div>
        {canControl && active && (
          <form
            className="announce-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const text = announceDraft.trim();
              if (!text) return;
              setBusy(true);
              setMessage(null);
              const res = await postHost(appId, "lifecycle", hostToken, { action: "announce", text });
              if (res.ok) setAnnounceDraft("");
              else setMessage(errorText(res.code, locale, res.params));
              await refresh();
              setBusy(false);
            }}
          >
            <input className="input" aria-label={s.announceLabel} placeholder={s.announcePlaceholder} maxLength={140} value={announceDraft} onChange={(e) => setAnnounceDraft(e.target.value)} />
            <button className="btn" type="submit" disabled={busy || !announceDraft.trim()}>{s.announceSend}</button>
            {state.announcement && (
              <button className="btn" type="button" disabled={busy} onClick={() => run("lifecycle", { action: "announce", text: null })}>{s.announceClear}</button>
            )}
          </form>
        )}
        {canControl && state.spec.blocks.some((b) => b.type === "compose" && b.views.some((v) => v.kind === "settle")) && (
          <PayeeForm key={state.payee ? `${state.payee.bin}-${state.payee.account}` : "none"} appId={appId} hostToken={hostToken} locale={locale} payee={state.payee} refresh={refresh} />
        )}
        <AnnouncementBanner appId={appId} announcement={state.announcement} locale={locale} quiet />
        {!canControl && <div className="notice warn">{s.notHost}</div>}
        {message && <div className="notice warn" role="alert">{message}</div>}

        <div className="host-grid">
          <section className="card panel" aria-live="polite">
            {tabbed ? (
              <AppPagesTabs blocks={state.spec.blocks} badgeIds={blocksWithOpenStep(state.spec.blocks, state.runtime)} render={renderBlock} />
            ) : (
              state.spec.blocks.map(renderBlock)
            )}
          </section>
          <SharePanelQr appId={appId} locale={locale} participantCount={state.participantCount} />
        </div>

        {canControl && <RemixPanel appId={appId} hostToken={hostToken} locale={locale} disabled={!!state.movedTo} firstBlock={state.spec.blocks[0]} />}
      </main>

      {confirmEnd && (
        <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="end-title">
          <div className="card dialog">
            <h2 id="end-title" style={{ fontSize: 20 }}>{s.endConfirm}</h2>
            <div className="toolbar" style={{ justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setConfirmEnd(false)} autoFocus>{s.cancel}</button>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  setConfirmEnd(false);
                  await run("lifecycle", { action: "end" });
                }}
              >
                {s.endYes}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
