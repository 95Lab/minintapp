// Shown when an app has ended, expired, been blocked, or no longer exists.
// Offers "create a similar app" with the original prompt (never the participants' data).
import Link from "next/link";
import type { GoneResponse } from "@/engine/api/api-contract-types";
import { t, type UiLocale } from "@/engine/i18n/ui-strings-vi-en";

export function ExpiredNotice({ gone, locale = "vi" }: { gone: GoneResponse; locale?: UiLocale }) {
  const s = t(locale);
  // Fixed Vietnam time zone so server-rendered and client-rendered pages agree.
  const time = gone.endedAt
    ? new Date(gone.endedAt).toLocaleTimeString(locale === "vi" ? "vi-VN" : "en-US", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" })
    : "";
  const body =
    gone.reason === "ended" ? s.goneEnded(time) : gone.reason === "expired" ? s.goneExpired(time) : gone.reason === "blocked" ? s.goneBlocked : s.goneNotFound;
  const firstPrompt = gone.prompt;
  return (
    <main className="gone">
      <div className="card">
        <div className="gone-icon" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
        </div>
        <h1 style={{ fontSize: 24 }}>{s.goneTitle}</h1>
        {gone.title && <div style={{ fontWeight: 600 }}>{gone.title}</div>}
        <p className="muted" style={{ margin: 0 }}>{body}</p>
        <div className="toolbar" style={{ justifyContent: "center" }}>
          {firstPrompt && (
            <Link className="btn btn-primary" href={`/?prompt=${encodeURIComponent(firstPrompt)}`}>
              {s.makeSimilar}
            </Link>
          )}
          <Link className="btn" href="/">{s.backHome}</Link>
        </div>
      </div>
    </main>
  );
}
