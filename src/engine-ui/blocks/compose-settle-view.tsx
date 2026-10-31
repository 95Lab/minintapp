"use client";
// Settle-up view: who paid what, who owes whom, and — when the host entered a bank account — a VietQR
// for what the viewer owes. Everything is computed on the server (compose-settle-view.ts); the QR text is
// built here from the host's payee and the viewer's own balance, then drawn locally (no QR service).
// Collect rule (lib/money/settle-payment-qr.ts): with a payee, the host is the cashier.
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { ComposeViewResult } from "@/engine/api/api-contract-types";
import { t, type UiLocale } from "@/engine/i18n/ui-strings-vi-en";
import type { PublicPayee } from "@/engine/money/payee";
import { amountOwedBy, isVndUnit, paymentQrText } from "@/engine/money/settle-payment-qr";

type SettleResult = Extract<ComposeViewResult, { kind: "settle" }>;

/** What the surrounding block passes in: the payee and app title for the QR, and the mark actions. */
export interface SettleActions {
  payee: PublicPayee | null;
  appTitle: string;
  /** phones: says "I've transferred" with the amount owed right now, or withdraws it (null) */
  onMarkPaid?: (amount: number | null) => void;
  /** host screen: sets the total received from a person (whole đồng; 0 undoes it) */
  onConfirmReceived?: (rosterId: string, amount: number) => void;
}

/** The QR for one payment, with the bank details and the warning that must stay under every code. */
function PaymentQr({ payee, amount, appTitle, name, amountText, locale }: { payee: PublicPayee; amount: number; appTitle: string; name: string; amountText: string; locale: UiLocale }) {
  const s = t(locale);
  const [image, setImage] = useState("");
  const text = paymentQrText(payee, amount, appTitle, name);
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(text, { errorCorrectionLevel: "M", margin: 2, width: 480, color: { dark: "#12141a", light: "#ffffff" } })
      .then((url) => live && setImage(url))
      .catch(() => live && setImage(""));
    return () => {
      live = false;
    };
  }, [text]);
  return (
    <div className="settle-qr" data-testid="settle-qr">
      {image && (
        // eslint-disable-next-line @next/next/no-img-element -- data URL generated locally
        <img src={image} alt={s.settleQrAlt} width={240} height={240} data-testid="vietqr-image" />
      )}
      <dl className="settle-qr-details">
        <dt>{s.settleBank}</dt>
        <dd>{payee.bankName}</dd>
        <dt>{s.settleAccount}</dt>
        <dd className="num">{payee.account}</dd>
        <dt>{s.settleAccountName}</dt>
        <dd>{payee.name}</dd>
        <dt>{s.settleAmount}</dt>
        <dd className="num">{amountText}</dd>
      </dl>
      <p className="notice warn" style={{ margin: 0 }} data-testid="vietqr-warning">{s.settleOnlyIfKnow(payee.name)}</p>
    </div>
  );
}

export function ComposeSettleView({ view, locale, format, actions }: { view: SettleResult; locale: UiLocale; format: (n: number) => string; actions: SettleActions }) {
  const s = t(locale);
  const { payee } = actions;
  if (view.people.length === 0) return <p className="muted" style={{ margin: 0 }}>{s.settleEmpty}</p>;

  const me = view.people.find((p) => p.mine);
  const owed = amountOwedBy(me);
  const marks = (p: { markedPaid: boolean; markOutdated: boolean; received: boolean; receivedAmount: number }) => (
    <>
      {p.markedPaid && <span className="chip">✓ {s.settleMarkPaid}</span>}
      {p.markOutdated && <span className="chip">⚠ {s.settleMarkOutdated}</span>}
      {p.received && <span className="chip">✓✓ {s.settleMarkReceived} {format(p.receivedAmount)}</span>}
    </>
  );

  // Lines addressed to the viewer; with a payee they owe the payee instead of the people in the transfer list.
  const lines: string[] = [];
  if (me && payee) {
    if (owed > 0) lines.push(s.settleYouPay(format(owed), payee.name));
    else if (me.balance < 0) lines.push(s.settlePaidUp);
    else if (me.balance > 0) lines.push(s.settleHostRepays(format(me.balance)));
  } else {
    for (const tr of view.transfers) {
      if (tr.mine === "pay") lines.push(s.settleYouPay(format(tr.amount), tr.to));
      else if (tr.mine === "receive") lines.push(s.settleYouGet(format(tr.amount), tr.from));
    }
  }
  if (me && lines.length === 0) lines.push(s.settleYouEven);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="total-band" style={{ marginTop: 0 }}>
        <span style={{ fontWeight: 600 }}>{s.settleTotal}</span>
        <strong className="num">{format(view.total)}</strong>
      </div>

      {lines.length > 0 && (
        <div className="settle-mine" data-testid="settle-mine">
          {lines.map((line, i) => (
            <strong key={i}>{line}</strong>
          ))}
          {owed > 0 && actions.onMarkPaid && me && (
            <div className="toolbar">
              <button className="btn btn-app" type="button" onClick={() => actions.onMarkPaid!(me.markedPaid ? null : owed)}>
                {me.markedPaid ? s.settleUndoPaid : s.settleIPaid}
              </button>
              {marks(me)}
            </div>
          )}
        </div>
      )}

      {payee && me && owed > 0 && isVndUnit(view.unit) && (
        <PaymentQr payee={payee} amount={owed} appTitle={actions.appTitle} name={me.name} amountText={format(owed)} locale={locale} />
      )}

      <div className="compose-balances">
        {view.people.map((p) => (
          <div key={p.id} className="compose-balance settle-person">
            <span>
              {p.name} {p.mine && <span className="muted">•</span>}
            </span>
            <span className="num muted">
              {format(p.paid)} {s.settlePaidOut}
            </span>
            <span className={`num ${p.balance >= 0 ? "pos" : "neg"}`}>
              {p.balance >= 0 ? "+" : "−"}
              {format(Math.abs(p.balance))}
            </span>
            {p.balance < 0 && (
              <span className="settle-marks">
                {marks(p)}
                {actions.onConfirmReceived && p.remaining > 0 && (
                  <button className="btn btn-sm" type="button" onClick={() => actions.onConfirmReceived!(p.id, p.receivedAmount + p.remaining)}>
                    {s.settleConfirmReceived} {format(p.remaining)}
                  </button>
                )}
                {actions.onConfirmReceived && p.received && (
                  <button className="btn btn-sm btn-ghost" type="button" onClick={() => actions.onConfirmReceived!(p.id, 0)}>
                    {s.settleUnconfirmReceived}
                  </button>
                )}
              </span>
            )}
          </div>
        ))}
      </div>

      {payee ? (
        <p className="muted" style={{ margin: 0 }}>{s.settleCollectNote(payee.name)}</p>
      ) : view.transfers.length ? (
        <ol className="compose-transfers">
          {view.transfers.map((tr) => (
            <li key={`${tr.fromId}-${tr.toId}`}>
              <b>{tr.from}</b> → <b>{tr.to}</b>: <span className="num">{format(tr.amount)}</span> {marks(tr)}
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted" style={{ margin: 0 }}>{s.composeSettled}</p>
      )}
    </div>
  );
}
