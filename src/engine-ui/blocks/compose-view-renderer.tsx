"use client";
// Renders one computed compose view (compose-view-aggregators.ts). Pure presentation: every number,
// seat and balance arrives computed by the server. `big` = projector size on the host screen.
import type { ComposeViewResult } from "@/engine/api/api-contract-types";
import { t, type UiLocale } from "@/engine/i18n/ui-strings-vi-en";
import { BarChartLive } from "./bar-chart-live";
import { ComposeOrdersView } from "./compose-orders-view";
import { ComposeBoardView } from "./compose-board-view";
import { ComposeChatView } from "./compose-chat-view";
import { ComposeMapView } from "./compose-map-view";
import { ComposeSettleView, type SettleActions } from "./compose-settle-view";
import { ComposeTeamsView } from "./compose-teams-view";
import { WordCloud } from "./word-cloud";

export function formatComposeNumber(n: number, unit: string | null, locale: UiLocale): string {
  const text = new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US", { maximumFractionDigits: 2 }).format(n);
  if (!unit) return text;
  return unit === "đ" ? `${text}đ` : `${text} ${unit}`;
}

/** `blockTitle`: a view titled like its block (e.g. a poll's chart) does not repeat the heading. */
/** `onLike`: phones only — likes a board entry (the host screen just shows counts). */
export function ComposeViewCard({
  view,
  locale,
  big = false,
  blockTitle,
  onLike,
  onModerate,
  onRemoveMessage,
  settle,
}: {
  view: ComposeViewResult;
  locale: UiLocale;
  big?: boolean;
  blockTitle?: string;
  onLike?: (entryId: string, like: boolean) => Promise<boolean>;
  /** host only: approve / hide a participant's photo */
  onModerate?: (photoId: string, on: boolean) => void;
  /** phones: deletes one of the viewer's own chat messages (by its record id) */
  onRemoveMessage?: (itemId: string) => void;
  /** settle view: the payee for the QR and the paid / received mark actions */
  settle?: SettleActions;
}) {
  const title = view.title === blockTitle ? "" : view.title;
  return (
    <section className="compose-view" aria-label={title || undefined}>
      {title && <div className="panel-title">{title}</div>}
      <ComposeViewBody view={view} locale={locale} big={big} onLike={onLike} onModerate={onModerate} onRemoveMessage={onRemoveMessage} settle={settle} />
    </section>
  );
}

function ComposeViewBody({
  view,
  locale,
  big,
  onLike,
  onModerate,
  onRemoveMessage,
  settle,
}: {
  view: ComposeViewResult;
  locale: UiLocale;
  big: boolean;
  onLike?: (entryId: string, like: boolean) => Promise<boolean>;
  onModerate?: (photoId: string, on: boolean) => void;
  onRemoveMessage?: (itemId: string) => void;
  settle?: SettleActions;
}) {
  const s = t(locale);
  const num = (n: number, unit: string | null = null) => formatComposeNumber(n, unit, locale);
  switch (view.kind) {
    case "bars":
      return <BarChartLive total={view.total} data={view.bars} />;
    case "stat":
      return (
        <div className="stat-tile">
          <span className="muted">{s.composeStatOps[view.op]}</span>
          <strong className="num">{view.value === null ? "—" : num(view.value, view.unit)}</strong>
        </div>
      );
    case "table":
      return view.rows.length ? (
        <div className="table-wrap">
          <table className="orders">
            <thead>
              <tr>
                {view.keyColumn !== null && <th>{view.keyColumn ?? s.composeName}</th>}
                {view.columns.map((c, i) => (
                  <th key={i}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j}>{typeof cell === "number" ? num(cell) : cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted" style={{ margin: 0 }}>—</p>
      );
    case "leaderboard":
      return view.rows.length ? (
        <ol className="lb">
          {view.rows.map((row, i) => (
            <li key={`${row.name}-${i}`}>
              <span className="rank num">{i + 1}</span>
              <span>{row.name}</span>
              <span className="num">{num(row.value, view.unit)}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted" style={{ margin: 0 }}>—</p>
      );
    case "cloud":
      return <WordCloud words={view.words} big={big} />;
    case "groups":
      return (
        <div className="compose-groups">
          {view.groups.map((g) => (
            <div key={g.id} className="compose-group">
              <div className="compose-group-head">
                <span>{g.label}</span>
                <span className="num muted">{g.capacity ? `${g.names.length}/${g.capacity}` : g.names.length}</span>
              </div>
              <div className="compose-names">
                {g.names.length ? g.names.map((n, i) => <span key={i} className="chip">{n}</span>) : <span className="muted">—</span>}
              </div>
              {g.waitlist.length > 0 && (
                <div className="muted" style={{ fontSize: 13 }}>
                  {s.composeWaitlist}: {g.waitlist.join(", ")}
                </div>
              )}
            </div>
          ))}
        </div>
      );
    case "split":
      return (
        <div style={{ display: "grid", gap: 12 }}>
          <div className="total-band" style={{ marginTop: 0 }}>
            <span style={{ fontWeight: 600 }}>{s.composeTotal}</span>
            <strong className="num">{num(view.total, view.unit)}</strong>
          </div>
          <div className="compose-share">
            <span>{s.composePerPerson}</span>
            <span className="num">{num(view.share, view.unit)}</span>
          </div>
          {view.people.length > 0 && (
            <div className="compose-balances">
              {view.people.map((p, i) => (
                <div key={i} className="compose-balance">
                  <span>{p.name}</span>
                  <span className="num muted">{num(p.paid, view.unit)}</span>
                  <span className={`num ${p.balance >= 0 ? "pos" : "neg"}`}>
                    {p.balance >= 0 ? "+" : "−"}
                    {num(Math.abs(p.balance), view.unit)}
                  </span>
                </div>
              ))}
            </div>
          )}
          {view.transfers.length ? (
            <ol className="compose-transfers">
              {view.transfers.map((tr, i) => (
                <li key={i}>
                  <b>{tr.from}</b> → <b>{tr.to}</b>: <span className="num">{num(tr.amount, view.unit)}</span>
                </li>
              ))}
            </ol>
          ) : (
            view.people.length > 1 && <p className="muted" style={{ margin: 0 }}>{s.composeSettled}</p>
          )}
        </div>
      );
    case "orders":
      return <ComposeOrdersView view={view} locale={locale} big={big} />;
    case "teams":
      return <ComposeTeamsView view={view} locale={locale} />;
    case "fastest":
      return (
        <div style={{ display: "grid", gap: 10 }}>
          {view.round && <div className="muted">{view.round.label}</div>}
          {!view.round ? (
            <p className="muted" style={{ margin: 0 }}>{s.composeFastestWaiting}</p>
          ) : view.order.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>{s.composeFastestNobody}</p>
          ) : (
            <ol className={`lb${big ? " big" : ""}`}>
              {view.order.map((p, i) => (
                <li key={`${p.name}-${i}`}>
                  <span className="rank num">{i + 1}</span>
                  <span>{p.name}</span>
                  <span className="num">{i === 0 ? "⚡" : `+${(p.afterMs / 1000).toFixed(2)} s`}</span>
                </li>
              ))}
            </ol>
          )}
          {view.wins.length > 0 && (
            <div className="muted">
              {s.composeRoundsWon}: {view.wins.map((w) => `${w.name} ${w.rounds}`).join(" · ")}
            </div>
          )}
        </div>
      );
    case "ranking":
      return view.items.length ? (
        <>
          <ol className="lb">
            {view.items.map((item, i) => (
              <li key={item.id}>
                <span className="rank num">{i + 1}</span>
                <span>{item.label}</span>
                <span className="num">{s.composeRankPoints(item.points)}</span>
              </li>
            ))}
          </ol>
          <div className="muted num" style={{ marginTop: 6 }}>{s.composeRankVoters(view.voters)}</div>
        </>
      ) : (
        <p className="muted" style={{ margin: 0 }}>—</p>
      );
    case "board":
      return <ComposeBoardView view={view} locale={locale} big={big} onLike={onLike} onModerate={onModerate} />;
    case "map":
      return <ComposeMapView view={view} locale={locale} big={big} />;
    case "chat":
      return <ComposeChatView view={view} locale={locale} big={big} onRemove={onRemoveMessage} />;
    case "settle":
      return <ComposeSettleView view={view} locale={locale} format={(n) => num(n, view.unit)} actions={settle ?? { payee: null, appTitle: "" }} />;
    case "pending":
      return <p className="muted" style={{ margin: 0 }}>{view.reason === "step" ? s.composeHiddenUntilStep : s.resultsHidden}</p>;
  }
}
