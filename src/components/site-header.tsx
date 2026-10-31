"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { BrandLogo } from "./brand-logo";
import { LanguageSwitcher, useLocale } from "@/lib/i18n/locale-provider";
import { fetchSession } from "@/engine/auth/account-client";
import type { SessionResponse } from "@/engine/api/api-contract-types";
import { SignOutButton } from "./account/sign-out-button";
import styles from "./site-header.module.css";

export function SiteHeader({ home = false, children }: { home?: boolean; children?: ReactNode }) {
  const { locale, platformOrigin } = useLocale();
  const destination=(path:string)=>platformOrigin+path;
  const text = (vi:string,en:string)=>locale === "vi" ? vi : en;
  const [open,setOpen]=useState(false);
  const [session,setSession]=useState<SessionResponse|null>(null);
  const navigationId=useId();
  const accountMenu=useRef<HTMLDetailsElement>(null);
  const toggle=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    let active=true;
    const refresh=()=>{if(platformOrigin)return;void fetchSession().then(value=>{if(active)setSession(value);});};
    refresh();
    window.addEventListener("focus",refresh);
    return()=>{active=false;window.removeEventListener("focus",refresh);};
  },[platformOrigin]);
  useEffect(()=>{const dismiss=(event:PointerEvent)=>{if(accountMenu.current?.open && !accountMenu.current.contains(event.target as Node))accountMenu.current.open=false;};document.addEventListener("pointerdown",dismiss);return()=>document.removeEventListener("pointerdown",dismiss);},[]);
  function close(){setOpen(false);}
  return <header className={styles.header} data-open={open} onKeyDown={event=>{if(event.key==="Escape"){close();if(accountMenu.current?.open){accountMenu.current.open=false;accountMenu.current.querySelector("summary")?.focus();}else toggle.current?.focus();}}}>
    <BrandLogo href={destination("/")} label={text("MinintApp, trang chủ","MinintApp, home")} />
    <nav id={navigationId} className={styles.navigation} aria-label={text("Điều hướng chính","Main navigation")}>
      <Link onClick={close} href={destination("/templates")}>{text("Khám phá tất cả mẫu","Explore all templates")}</Link>
      {session?.user && <Link onClick={close} href={destination("/dashboard")}>{text("Ứng dụng của tôi","My apps")}</Link>}
      <Link onClick={close} href={home ? "#how-it-works" : destination("/#how-it-works")}>{text("Cách hoạt động","How it works")}</Link>
      <LanguageSwitcher />
      <Link onClick={close} className={styles.create} href={home ? "#create" : destination("/#create")}>{text("Tạo ứng dụng","Create an app")} <span aria-hidden="true">↗</span></Link>
    </nav>
    <div className={styles.account}>
      {session?.user ? <><details ref={accountMenu} className={styles.accountMenu}><summary>{text("Tài khoản","Account")} <span aria-hidden="true">⌄</span></summary><div><p>{session.user.email}</p><Link href={destination("/my-apps")}>{text("App của tôi","My apps")}</Link></div></details><SignOutButton className={styles.login} /></>
        : <Link className={styles.login} href={destination("/login")}>{text("Đăng nhập","Sign in")}</Link>}
    </div>
    <button ref={toggle} type="button" className={styles.toggle} aria-expanded={open} aria-controls={navigationId} aria-label={text(open?"Đóng menu":"Mở menu",open?"Close menu":"Open menu")} onClick={()=>setOpen(!open)}><span aria-hidden="true">{open ? "×" : "☰"}</span></button>
    {children && <div className={styles.context}>{children}</div>}
  </header>;
}
