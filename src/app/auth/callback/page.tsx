"use client";
// Where the emailed magic link lands. Supabase Auth redirects here with the session in the URL fragment
// (#access_token=…, implicit flow — the server asks for exactly that). The fragment never reaches a server
// log; it is removed from the address bar at once, the token goes to /api/auth/session once to become our
// own cookie, and apps this browser holds host tokens for are offered to the account.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BrandTopBar } from "@/engine-ui/brand-top-bar";
import { claimLocalApps, exchangeAccessToken } from "@/engine/auth/account-client";
import { ACCOUNT_STRINGS, savedUiLocale } from "@/engine/i18n/account-strings-vi-en";

export default function AuthCallbackPage() {
  const [failed, setFailed] = useState(false);
  const [locale, setLocale] = useState<"vi" | "en">("vi");
  const started = useRef(false);

  useEffect(() => {
    setLocale(savedUiLocale());
    if (started.current) return;
    started.current = true;
    const accessToken = new URLSearchParams(window.location.hash.slice(1)).get("access_token");
    history.replaceState(null, "", window.location.pathname);
    if (!accessToken) return setFailed(true);
    void exchangeAccessToken(accessToken).then(async (res) => {
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
