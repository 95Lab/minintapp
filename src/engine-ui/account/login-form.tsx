"use client";
// /login: email → magic link. The reply is the same whether or not the address has an account.
import { useEffect, useState } from "react";
import { BrandTopBar } from "@/engine-ui/brand-top-bar";
import { requestMagicLink } from "@/engine/auth/account-client";
import { errorText } from "@/engine/api/app-error-codes";
import { ACCOUNT_STRINGS, savedUiLocale } from "@/engine/i18n/account-strings-vi-en";

export function LoginForm() {
  const [locale, setLocale] = useState<"vi" | "en">("vi");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setLocale(savedUiLocale()), []);
  const s = ACCOUNT_STRINGS[locale];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await requestMagicLink(email.trim());
    if (res.ok) setSent(true);
    else setError(errorText(res.code, locale, res.params));
    setBusy(false);
  }

  return (
    <>
      <BrandTopBar />
      <main className="home" style={{ maxWidth: 520 }}>
        {sent ? (
          <section className="card panel" role="status" style={{ display: "grid", gap: 12 }}>
            <h1 style={{ fontSize: 24 }}>{s.checkEmail}</h1>
            <p className="muted">{s.checkEmailLead}</p>
            <button className="btn" type="button" onClick={() => setSent(false)}>{s.backToLogin}</button>
          </section>
        ) : (
          <form className="card panel" onSubmit={submit} style={{ display: "grid", gap: 12 }}>
            <h1 style={{ fontSize: 24 }}>{s.loginTitle}</h1>
            <p className="muted">{s.loginLead}</p>
            <label htmlFor="login-email">{s.emailLabel}</label>
            <input id="login-email" className="input" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
            {error && <div className="notice warn" role="alert">{error}</div>}
            <button className="btn btn-primary" type="submit" disabled={busy || !email.trim()}>{busy ? s.sending : s.sendLink}</button>
          </form>
        )}
      </main>
    </>
  );
}
