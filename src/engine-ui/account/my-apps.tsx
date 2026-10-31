"use client";
// /my-apps: the signed-in host's apps. "Open host page" works without the host token on this device
// (the session cookie proves ownership); extend and end go through the normal lifecycle route.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BrandTopBar } from "@/engine-ui/brand-top-bar";
import { fetchAccountApps } from "@/engine/auth/account-client";
import { postHost } from "@/engine/api/api-client";
import { errorText } from "@/engine/api/app-error-codes";
import type { AccountAppsResponse } from "@/engine/api/api-contract-types";
import { ACCOUNT_STRINGS, savedUiLocale } from "@/engine/i18n/account-strings-vi-en";

export function MyApps() {
  const [locale, setLocale] = useState<"vi" | "en">("vi");
  const [data, setData] = useState<AccountAppsResponse | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const s = ACCOUNT_STRINGS[locale];

  const load = useCallback(async () => {
    const res = await fetchAccountApps();
    if (res.ok) setData(res);
    else if (res.code === "sign_in_required") window.location.replace("/login");
    else setMessage(errorText(res.code, savedUiLocale(), res.params));
  }, []);

  useEffect(() => {
    setLocale(savedUiLocale());
    const claimed = Number(new URLSearchParams(window.location.search).get("claimed"));
    if (claimed > 0) {
      setMessage(ACCOUNT_STRINGS[savedUiLocale()].claimedSome(claimed));
      history.replaceState(null, "", window.location.pathname);
    }
    void load();
  }, [load]);

  async function act(id: string, body: { action: "extend"; by: "7d" } | { action: "end" }) {
    if (body.action === "end" && !window.confirm(s.endAppConfirm)) return;
    setBusyId(id);
    setMessage(null);
    const res = await postHost(id, "lifecycle", null, body);
    if (!res.ok) setMessage(errorText(res.code, locale, res.params));
    await load();
    setBusyId(null);
  }

  return (
    <>
      <BrandTopBar />
      <main className="home">
        <h1 style={{ fontSize: 28 }}>{s.myAppsTitle}</h1>
        {data && <p className="muted">{s.signedInAs(data.email)}. {s.maxLifetimeNote}</p>}
        {message && <div className="notice warn" role="status">{message}</div>}
        {!data ? (
          <p className="muted">{s.loading}</p>
        ) : data.apps.length === 0 ? (
          <p className="muted">{s.myAppsEmpty}</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 12 }}>
            {data.apps.map((a) => (
              <li key={a.id} className="card panel" style={{ display: "grid", gap: 8 }} data-testid="my-app">
                <b style={{ fontSize: 18 }}>{a.title}</b>
                <span className="muted">
                  {a.status === "closed" ? s.statusClosed : s.statusActive} · {s.expiresAt} {new Date(a.expiresAt).toLocaleString(locale === "vi" ? "vi-VN" : "en-GB")}
                </span>
                <div className="toolbar">
                  <Link className="btn btn-primary" href={`/rooms/${a.id}/host`}>{s.openHost}</Link>
                  <button className="btn" type="button" disabled={busyId === a.id} onClick={() => act(a.id, { action: "extend", by: "7d" })}>{s.extend7d}</button>
                  <button className="btn btn-danger" type="button" disabled={busyId === a.id} onClick={() => act(a.id, { action: "end" })}>{s.endApp}</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
