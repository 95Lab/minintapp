"use client";
// Header links for host accounts: "Đăng nhập" or email + "App của tôi" + "Đăng xuất". Renders nothing
// until the server says accounts are enabled, so the offline/memory build never shows sign-in.
import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchSession, signOut } from "@/engine/auth/account-client";
import type { SessionResponse } from "@/engine/api/api-contract-types";
import { ACCOUNT_STRINGS, savedUiLocale } from "@/engine/i18n/account-strings-vi-en";

export function AccountNav() {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [locale, setLocale] = useState<"vi" | "en">("vi");
  useEffect(() => {
    setLocale(savedUiLocale());
    void fetchSession().then(setSession);
  }, []);
  if (!session?.accountsEnabled) return null;
  const s = ACCOUNT_STRINGS[locale];
  if (!session.user) return <Link className="btn btn-ghost" href="/login">{s.signIn}</Link>;
  return (
    <>
      <Link className="btn btn-ghost" href="/my-apps" title={session.user.email}>{s.myApps}</Link>
      <button
        className="btn btn-ghost"
        type="button"
        onClick={async () => {
          await signOut();
          window.location.assign("/");
        }}
      >
        {s.signOut}
      </button>
    </>
  );
}
