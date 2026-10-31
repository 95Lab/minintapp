"use client";
// Big QR + join link for the projector. The QR encodes this page's origin, so on a laptop
// the host should open the app via its LAN IP for phones to reach it.
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { UiLocale } from "@/engine/i18n/ui-strings-vi-en";
import { t } from "@/engine/i18n/ui-strings-vi-en";

export function SharePanelQr({ appId, locale, participantCount, urlOverride }: { appId: string; locale: UiLocale; participantCount: number; urlOverride?: string }) {
  const s = t(locale);
  const [url, setUrl] = useState("");
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const [isLocalhost, setIsLocalhost] = useState(false);

  useEffect(() => {
    const joinUrl = urlOverride || `${window.location.origin}/rooms/${appId}`;
    setUrl(joinUrl);
    setIsLocalhost(/^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname));
    QRCode.toDataURL(joinUrl, { errorCorrectionLevel: "M", margin: 1, width: 720, color: { dark: "#12141a", light: "#ffffff" } })
      .then(setQr)
      .catch(() => setQr(""));
  }, [appId, urlOverride]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard refused: the link is visible and selectable */
    }
  }

  return (
    <aside className="card panel qr-panel" aria-label={s.scanToJoin}>
      <div className="panel-title" style={{ marginBottom: 0 }}>{s.scanToJoin}</div>
      <div className="qr-box">
        {qr && (
          // eslint-disable-next-line @next/next/no-img-element -- data URL generated locally
          <img src={qr} alt={`QR: ${url}`} width={720} height={720} style={{ width: "100%", height: "100%" }} />
        )}
      </div>
      <div className="join-url num">{url.replace(/^https?:\/\//, "")}</div>
      <div className="muted" style={{ fontSize: 14 }}>{s.noInstall}</div>
      <div className="toolbar" style={{ justifyContent: "center" }}>
        <button className="btn btn-sm" onClick={copy} type="button">{copied ? s.copied : s.copyLink}</button>
        <a className="btn btn-sm" href={`/rooms/${appId}`} target="_blank" rel="noopener">{s.openAsParticipant}</a>
      </div>
      <span className="pill num">{s.participants(participantCount)}</span>
      {isLocalhost && <p className="notice warn" style={{ margin: 0, fontSize: 13, textAlign: "left" }}>{s.lanHint}</p>}
    </aside>
  );
}
