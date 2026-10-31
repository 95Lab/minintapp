"use client";
import { SiteHeader } from "./site-header";
export function BrandTopBar({ children }: { children?: React.ReactNode }) {
  return <SiteHeader>{children}</SiteHeader>;
}
