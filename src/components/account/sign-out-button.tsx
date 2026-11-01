"use client";
import { useState } from "react";
import { signOut } from "@/engine/auth/account-client";
import { useLocale } from "@/lib/i18n/locale-provider";
import styles from "./sign-out-button.module.css";

export function SignOutButton({ className = "" }: { className?: string }) {
  const { locale , localize} = useLocale();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  async function logout() {
    if (busy) return;
    setBusy(true); setFailed(false);
    const result = await signOut();
    if (result.ok) { window.location.assign("/"); return; }
    setBusy(false); setFailed(true);
  }
  return <span className={styles.wrapper}>
    <button className={className} type="button" disabled={busy} aria-busy={busy} onClick={logout}>
      {busy?localize("Đang đăng xuất…","Signing out…"):localize("Đăng xuất","Sign out")}
    </button>
    {failed && <span className={styles.error} role="alert">{localize("Chưa đăng xuất được. Vui lòng thử lại.","Could not sign out. Please try again.")}</span>}
  </span>;
}
