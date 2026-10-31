"use client";
// Host form for the bank account a settle-up view's QR pays into. Bank comes from a fixed list; the
// server checks account digits and the holder name. Nothing here is ever filled in by the AI.
import { useState } from "react";
import { postHost } from "@/engine/api/api-client";
import { errorText } from "@/engine/api/app-error-codes";
import type { PublicPayee } from "@/engine/money/payee";
import { NAPAS_BANKS } from "@/engine/money/napas-banks";
import { t, type UiLocale } from "@/engine/i18n/ui-strings-vi-en";

export function PayeeForm({ appId, hostToken, locale, payee, refresh }: { appId: string; hostToken: string | null; locale: UiLocale; payee: PublicPayee | null; refresh: () => Promise<void> }) {
  const s = t(locale);
  const [bin, setBin] = useState(payee?.bin ?? "");
  const [account, setAccount] = useState(payee?.account ?? "");
  const [name, setName] = useState(payee?.name ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(next: { bin: string; account: string; name: string } | null) {
    setBusy(true);
    setError(null);
    const res = await postHost(appId, "lifecycle", hostToken, { action: "payee", payee: next });
    if (!res.ok) setError(errorText(res.code, locale, res.params));
    else if (!next) {
      setBin("");
      setAccount("");
      setName("");
    }
    await refresh();
    setBusy(false);
  }

  return (
    <form
      className="card panel"
      style={{ display: "grid", gap: 12 }}
      data-testid="payee-form"
      onSubmit={(e) => {
        e.preventDefault();
        void send({ bin, account: account.replace(/[\s.-]/g, ""), name: name.trim() });
      }}
    >
      <div>
        <div className="panel-title" style={{ marginBottom: 2 }}>{s.payeeTitle}</div>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>{s.payeeNote}</p>
      </div>
      <div className="payee-form">
        <div className="field">
          <label htmlFor="payee-bank">{s.payeeBank}</label>
          <select id="payee-bank" className="input" value={bin} onChange={(e) => setBin(e.target.value)} required>
            <option value="">{s.payeeBankPick}</option>
            {NAPAS_BANKS.map((b) => (
              <option key={b.bin} value={b.bin}>{b.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="payee-account">{s.payeeAccount}</label>
          <input id="payee-account" className="input num" inputMode="numeric" autoComplete="off" maxLength={24} value={account} onChange={(e) => setAccount(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="payee-name">{s.payeeName}</label>
          <input id="payee-name" className="input" autoComplete="off" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <button className="btn btn-app" type="submit" disabled={busy || !bin || !account.trim() || !name.trim()}>{s.payeeSave}</button>
        {payee && (
          <button className="btn" type="button" disabled={busy} onClick={() => void send(null)}>{s.payeeClear}</button>
        )}
      </div>
      {error && <div className="notice warn" role="alert">{error}</div>}
    </form>
  );
}
