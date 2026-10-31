"use client";
import { useLocale } from "@/lib/i18n/locale-provider";
import { RuntimeLocaleProvider } from "@/lib/i18n/runtime-locale";
import styles from "./preview.module.css";
import { useState } from "react";
import type { PublicAppSpec } from "@/lib/app-spec/strip-private-fields";
import type { AppRuntime } from "@/lib/blocks/block-definition-types";
import type { ResponsePayload } from "@/lib/blocks/block-registry";
import { BrandTopBar } from "@/components/brand-top-bar";
import { AppRendererParticipant } from "@/components/app-renderer-participant";
import { AppRendererHost } from "@/components/app-renderer-host";
import { HomeScreen } from "@/components/create/home-screen";
import { SharePanelQr } from "@/components/share/share-panel-qr";
import { AnnouncementBanner } from "@/components/announcement-banner";
import { LoginForm } from "@/components/account/login-form";
import { MyApps } from "@/components/account/my-apps";
import { RemixPanel } from "@/components/remix/remix-panel";
import { ExpiredNotice } from "@/components/lifecycle/expired-notice";
import { ComposeMapView } from "@/components/blocks/compose-map-view";
import { ComposePhotoUpload } from "@/components/blocks/compose-photo-upload";
import { CustomBlock } from "@/components/blocks/custom-block";
import { LiveBlock } from "@/components/blocks/live-block";
import { PayeeForm } from "@/components/payee-form";
export function ComponentPreview({ spec, runtime }: { spec: PublicAppSpec; runtime: AppRuntime }) {
  const [answers, setAnswers] = useState<Record<string, ResponsePayload>>({});
  const [view, setView] = useState("participant");
  const {locale}=useLocale();
  const text=(vi:string,en:string)=>locale==="vi"?vi:en;
  const demoSpec: PublicAppSpec={...spec,locale,title:text("Ứng dụng mẫu","Sample app"),blocks:spec.blocks.map(block=>block.type==="compose"?{...block,title:text("Chọn đồ uống","Choose a drink"),inputs:block.inputs.map(input=>({...input,label:text("Đồ uống","Drink"),options:input.options?.map(option=>({...option,label:option.id==="tea"?text("Trà","Tea"):text("Cà phê","Coffee")}))??null}))}:block.type==="quiz"?{...block,questions:block.questions.map(question=>({...question,prompt:text("Một cộng một bằng?","What is one plus one?"),options:question.options.map(option=>({...option,label:option.id==="a"?text("Hai","Two"):text("Ba","Three")}))}))}:block)};
  return <RuntimeLocaleProvider locale={locale}><div className={`mini-runtime ${styles.shell}`}><BrandTopBar /><main className={`component-preview ${styles.main}`}>
    <div className={styles.heading}><p className={styles.eyebrow}>COMPONENT LIBRARY</p><h1>{text("Thư viện component","Component library")}</h1><p>{text("Khám phá những khối nhỏ tạo nên ứng dụng của bạn. Thử giao diện và tương tác ngay tại đây.","Explore the building blocks of your apps. Try their interface and interactions here.")}</p></div>
    <div className={styles.demoNote}><span className={styles.badge}>{text("BẢN MINH HỌA","DEMO")}</span><p>{text("Câu trả lời chỉ lưu tạm trên trang này. Không gọi AI, gửi email hoặc lưu dữ liệu lên server.","Answers stay on this page only. No AI calls, emails or server-side storage.")}</p></div>
    <div className={`mini-preview-grid ${styles.grid}`}><div className={styles.stack}>
      <section className={`mini-card ${styles.runtime}`} aria-labelledby="runtime-title"><div className={styles.sectionHead}><div><p className={styles.eyebrow}>01 / {text("TRẢI NGHIỆM","EXPERIENCE")}</p><h2 id="runtime-title">{text("Giao diện ứng dụng","App interface")}</h2></div><label className="mini-field">{text("Chế độ xem","View mode")}<select value={view} onChange={e=>setView(e.target.value)}><option value="participant">{text("Người tham gia","Participant")}</option><option value="host">{text("Chủ ứng dụng","Host")}</option></select></label></div>
      <AnnouncementBanner announcement={{text:text("Dữ liệu minh họa để kiểm tra component.","Sample data for trying components."),at:0}} />
      {view==="participant"?<AppRendererParticipant spec={demoSpec} runtime={runtime} open myAnswers={answers} onSubmit={async(blockId,itemId,payload)=>{setAnswers(old=>({...old,[`${blockId}:${itemId}`]:payload}));return true;}}/>:<AppRendererHost spec={demoSpec} runtime={runtime} canControl={false}/>}</section>
      <section className={`mini-card ${styles.creation}`}><p className={styles.eyebrow}>02 / {text("TẠO ỨNG DỤNG","CREATION")}</p><HomeScreen templates={[{id:"poll",title:text("Bình chọn","Poll"),description:text("Lựa chọn và biểu đồ kết quả","Choices and result charts")},{id:"quiz",title:"Quiz",description:text("Câu hỏi và bảng xếp hạng","Questions and leaderboards")}]} /></section>
      <details className={`mini-card ${styles.details}`}><summary>{text("Tài khoản, remix và lifecycle","Account, remix and lifecycle")}</summary><div className={styles.samples}><LoginForm/><MyApps apps={[]}/><RemixPanel/><ExpiredNotice/></div></details>
      <details className={`mini-card ${styles.details}`}><summary>{text("Các điểm mở rộng chưa khả dụng","Extension placeholders")}</summary><div className={styles.samples}><ComposeMapView/><ComposePhotoUpload/><PayeeForm/><CustomBlock/><LiveBlock/></div></details>
    </div><aside className={styles.sidebar}><p className={styles.eyebrow}>03 / {text("CHIA SẺ","SHARING")}</p><SharePanelQr url="https://example.com/a/demo"/><p className={styles.hint}>{text("QR dẫn đến địa chỉ minh họa, không phải ứng dụng đã được tạo.","The QR points to an example address, not a created app.")}</p><a className={styles.statusLink} href="/api/health">{text("Kiểm tra trạng thái hệ thống","System status")} ↗</a></aside></div>
  </main></div></RuntimeLocaleProvider>;
}
