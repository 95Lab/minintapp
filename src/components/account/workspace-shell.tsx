"use client";
import Link from "next/link";
import {BrandLogo} from "@/components/brand-logo";
import {SiteHeader} from "@/components/site-header";
import {useLocale} from "@/lib/i18n/locale-provider";
import styles from "./workspace-shell.module.css";
export function WorkspaceShell({children}:{children:React.ReactNode}){
 const {locale, localize}=useLocale();const vi=locale==="vi";
 return <div className={styles.shell}><aside className={styles.sidebar} aria-label={localize("Không gian làm việc","Workspace")}><BrandLogo/><p className={styles.caption}>{localize("KHÔNG GIAN LÀM VIỆC","WORKSPACE")}</p><nav><Link href="/my-apps" aria-current="page"><span aria-hidden="true">▦</span>{localize("Ứng dụng của tôi","My apps")}</Link><Link href="/dashboard"><span aria-hidden="true">↗</span>{localize("Quản lý triển khai","Deployments")}</Link><Link href="/templates"><span aria-hidden="true">▤</span>{localize("Khám phá mẫu","Explore templates")}</Link></nav><div className={styles.note}><span aria-hidden="true">✳</span><h2>{localize("Ý tưởng nhỏ. Kết nối cả nhóm.","Small ideas. Bringing groups together.")}</h2><p>{localize("Tạo app từ một câu mô tả. Dùng ngay, chia sẻ dễ dàng.","Create an app from a prompt. Use it now, share it easily.")}</p><Link href="/#create">{localize("Tạo ứng dụng","Create an app")} ↗</Link></div></aside><div className={styles.content}><SiteHeader/>{children}</div></div>;
}
