"use client";
// Top bar shared by every screen: wordmark on the left, contextual controls on the right.
import { SiteHeader } from "@/components/site-header";

export function BoltIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M13.5 2 4 13.5h6.5L9.5 22 20 9.5h-6.6L13.5 2Z" />
    </svg>
  );
}

export function BrandTopBar({ children }: { children?: React.ReactNode }) {
  return <SiteHeader>{children}</SiteHeader>;
}
