"use client";
// PKCE callback: remove the one-use code before making API calls. Supabase access/refresh
// tokens stay on the server; the browser receives only the signed HttpOnly account cookie.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BrandTopBar } from "@/engine-ui/brand-top-bar";
import { claimLocalApps, exchangeAuthCode } from "@/engine/auth/account-client";
import { ACCOUNT_STRINGS, savedUiLocale } from "@/engine/i18n/account-strings-vi-en";

export default function AuthCallbackPage() {
  const [failed, setFailed] = useState(false);
  const [locale, setLocale] = useState<"vi" | "en">("vi");
  const started = useRef(false);

  useEffect(() => {
    setLocale(savedUiLocale());
    if (started.current) return;
    started.current = true;
    const parameters = new URLSearchParams(window.location.search);
    const code = parameters.get("code");
    const flowId = parameters.get("sb_flow_id") || undefined;
    history.replaceState(null, "", window.location.pathname);
    if (!code) return setFailed(true);
    void exchangeAuthCode(code, flowId).then(async (res) => {
      if (!res.ok) return setFailed(true);
      const claimed = await claimLocalApps();
      window.location.replace(claimed ? `/my-apps?claimed=${claimed}` : "/my-apps");
    });
  }, []);

  const s = ACCOUNT_STRINGS[locale];
  return (
    <>
      <BrandTopBar />
      <main className="home" style={{ maxWidth: 520 }}>
        <section className="card panel" role="status" style={{ display: "grid", gap: 12 }}>
          {failed ? (
            <>
              <h1 style={{ fontSize: 24 }}>{s.callbackFailed}</h1>
              <Link className="btn" href="/login">{s.backToLogin}</Link>
            </>
          ) : (
            <p>{s.callbackWorking}</p>
          )}
        </section>
      </main>
    </>
  );
}
