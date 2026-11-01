"use client";
import Link from "next/link";
import {SubdomainField} from "@/components/create/subdomain-field";
import { useCallback, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { useLocale } from "@/lib/i18n/locale-provider";
import type { Lifetime } from "@/engine/api/api-contract-types";
import { TemplateGallery } from "./template-gallery";
import styles from "./templates-screen.module.css";

export function TemplatesScreen() {
  const { locale } = useLocale();
  const [subdomain,setSubdomain]=useState<string|undefined>();
  const [domainValid,setDomainValid]=useState(true);
  const updateDomain=useCallback((name:string|undefined,valid:boolean)=>{setSubdomain(name);setDomainValid(valid);},[]);
  const [lifetime, setLifetime] = useState<Lifetime>("1h");
  const {localize:text}=useLocale();
  return <><SiteHeader /><main className={styles.main}>
    <div className={styles.heading}><p className={styles.eyebrow}>{text("BẮT ĐẦU TỪ ĐÂY", "START HERE")}</p><h1>{text("Có sẵn mẫu. Chọn là chạy.", "Pick a template. Make it yours.")}</h1><p>{text("Một cuộc bình chọn, một trò quiz, một lần kết nối. Chọn mẫu cho khoảnh khắc của bạn.", "A poll, a quiz, a moment together. Find a template for your next gathering.")}</p></div>
    <div className={styles.toolbar}><label>{text("Thời gian sử dụng", "App lifetime")}<select value={lifetime} onChange={e=>setLifetime(e.target.value as Lifetime)}><option value="1h">{text("1 giờ", "1 hour")}</option><option value="24h">{text("24 giờ", "24 hours")}</option><option value="7d">{text("7 ngày", "7 days")}</option></select></label><span>{text("Tạo từ mẫu không cần AI. Chia sẻ bằng link hoặc QR.", "Templates need no AI. Share with a link or QR.")}</span></div>
    <SubdomainField onChange={updateDomain}/><TemplateGallery locale={locale} lifetime={lifetime} subdomain={subdomain} domainValid={domainValid}/>
    <div className={styles.invite}><div><h2>{text("Có ý tưởng riêng?", "Have your own idea?")}</h2><p>{text("Mô tả nhu cầu, cùng AI tạo ứng dụng theo cách của bạn.", "Describe what you need and create your app with AI.")}</p></div><Link href="/#create">{text("Tạo từ ý tưởng", "Create from an idea")} ↗</Link></div>
  </main></>;
}
