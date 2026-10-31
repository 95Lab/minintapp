"use client";
// Orders view (group order / form). Host: every order with its line total + the grand total.
// Participants only ever receive count + total from the server, shown as one quiet line.
import type { ComposeViewResult } from "@/engine/api/api-contract-types";
import { t, type UiLocale } from "@/engine/i18n/ui-strings-vi-en";
import { formatVnd } from "./bar-chart-live";

type OrdersView = Extract<ComposeViewResult, { kind: "orders" }>;

export function ComposeOrdersView({ view, locale, big }: { view: OrdersView; locale: UiLocale; big: boolean }) {
  const s = t(locale);
  if (!big) {
    return (
      <div className="muted num" style={{ fontSize: 14 }}>
        {s.orders(view.count)}
        {view.priced ? ` · ${s.total} ${formatVnd(view.total)}` : ""}
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {view.rows.length > 0 ? (
        <div className="table-wrap">
          <table className="orders">
            <thead>
              <tr>
                <th>{s.composeName}</th>
                {view.columns.map((c, i) => (
                  <th key={i}>{c}</th>
                ))}
                {view.priced && <th className="r">{s.composeLineTotal}</th>}
              </tr>
            </thead>
            <tbody>
              {view.rows.map((row, i) => (
                <tr key={i}>
                  <td>{row.name}</td>
                  {row.cells.map((cell, j) => (
                    <td key={j}>{cell}</td>
                  ))}
                  {view.priced && <td className="r num">{formatVnd(row.lineTotal)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted" style={{ margin: 0 }}>{s.orders(0)}</p>
      )}
      <div className="total-band" style={{ marginTop: 0 }}>
        <span style={{ fontWeight: 600 }}>
          {s.orders(view.count)} · {s.composeQuantity} <span className="num">{view.totalQuantity}</span>
        </span>
        {view.priced && <strong className="num">{formatVnd(view.total)}</strong>}
      </div>
    </div>
  );
}
