"use client";
// Top bar shared by every screen: wordmark on the left, contextual controls on the right.
import { LanguageSwitcher } from "@/lib/i18n/locale-provider";
import Link from "next/link";
import { AccountNav } from "@/engine-ui/account/account-nav";

export function BoltIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M13.5 2 4 13.5h6.5L9.5 22 20 9.5h-6.6L13.5 2Z" />
    </svg>
  );
}

export function BrandTopBar({ children }: { children?: React.ReactNode }) {
  return (
    <header className="topbar">
      <Link href="/" className="brand" aria-label="MinintApp — trang chủ">
        <span className="brand-mark">
          <BoltIcon />
        </span>
        MinintApp
      </Link>
      <div className="host-meta">
        {children}
        <AccountNav />
        <LanguageSwitcher />
      </div>
    </header>
  );
}
