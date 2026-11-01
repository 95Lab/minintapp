"use client";
import {useLocale} from "@/lib/i18n/locale-provider";
import {localizeRecord} from "@/lib/i18n/japanese";
import { useState } from "react";
import type { Locale } from "@/lib/i18n/locale";
import styles from "./how-it-works.module.css";

const content = {
  vi: {
    eyebrow: "TỪ Ý TƯỞNG ĐẾN CẢ NHÓM", title: "Một ý tưởng nhỏ.\nBa bước để bắt đầu.", lead: "Bạn lo ý tưởng. MinintApp lo chỗ để mọi người cùng tham gia.",
    steps: [
      { title: "Nói điều bạn cần", description: "Mô tả nhu cầu bằng một câu hoặc bắt đầu từ mẫu có sẵn.", detail: "Ví dụ: một cuộc bình chọn đồ uống cho buổi workshop. Bạn có thể chọn thời gian sử dụng trước khi tạo bằng AI." },
      { title: "Gửi link, mời cả nhóm", description: "Chia sẻ link hoặc mã QR từ trang quản lý của bạn.", detail: "Người tham gia mở link trên điện thoại hoặc máy tính. Không cần tạo tài khoản để tham gia." },
      { title: "Cùng tham gia, xem kết quả", description: "Theo dõi câu trả lời và điều khiển ứng dụng từ trang quản lý.", detail: "Bạn có thể đóng, mở lại hoặc kết thúc ứng dụng. Kết quả hiển thị theo cấu hình của từng app." },
    ],
    example: "VÍ DỤ MINH HỌA", exampleTitle: "Từ một câu hỏi đến quyết định chung", promptLabel: "BẠN MUỐN TẠO GÌ?", prompt: "Tạo bình chọn đồ uống cho buổi workshop của nhóm.", promptHint: "Chọn mẫu hoặc mô tả bằng AI", lifetime: "Thời gian sử dụng", duration: "24 giờ", ready: "Bình chọn đã được tạo", shareTitle: "Một link. Mọi người cùng vào.", shareLead: "Lấy link hoặc QR từ trang quản lý, rồi gửi vào nhóm.", link: "Link tham gia của bạn", phone: "Điện thoại", desktop: "Máy tính", noAccount: "Người tham gia không cần tài khoản", resultTitle: "Hôm nay uống gì?", tea: "Trà", coffee: "Cà phê", resultNote: "Số liệu chỉ để minh họa", controls: "Bạn giữ quyền điều khiển", close: "Đóng / mở lại", end: "Kết thúc", next: "Xem bước tiếp theo", restart: "Xem lại từ đầu", cta: "Tạo ứng dụng của bạn", templates: "Hoặc khám phá mẫu có sẵn", step: "Bước", of: "/", region: "Minh họa cách hoạt động",
  },
  en: {
    eyebrow: "FROM AN IDEA TO EVERYONE", title: "One small idea.\nThree steps to get going.", lead: "Bring the idea. MinintApp gives everyone a place to join in.",
    steps: [
      { title: "Tell us what you need", description: "Describe your idea in a sentence or start with a ready-made template.", detail: "For example, a drinks poll for your workshop. Choose how long you need it before creating it with AI." },
      { title: "Share a link, invite everyone", description: "Get a link or QR code from your host page and share it.", detail: "People can open it on a phone or computer. No account is needed to participate." },
      { title: "Join in and see the results", description: "Follow the responses and manage your app from the host page.", detail: "Close, reopen or end the app when needed. Results are shown according to each app’s settings." },
    ],
    example: "ILLUSTRATIVE EXAMPLE", exampleTitle: "From a question to a group decision", promptLabel: "WHAT WOULD YOU LIKE TO MAKE?", prompt: "Create a drinks poll for our team workshop.", promptHint: "Pick a template or describe it with AI", lifetime: "App lifetime", duration: "24 hours", ready: "Your poll has been created", shareTitle: "One link. Everyone can join.", shareLead: "Get a link or QR from the host page and send it to the group.", link: "Your participant link", phone: "Phone", desktop: "Computer", noAccount: "No account needed to participate", resultTitle: "What are we drinking today?", tea: "Tea", coffee: "Coffee", resultNote: "Figures are for illustration only", controls: "You stay in control", close: "Close / reopen", end: "End app", next: "See the next step", restart: "Start again", cta: "Create your app", templates: "Or explore ready-made templates", step: "Step", of: "/", region: "How it works illustration",
  },
};

export function HowItWorks({ locale }: { locale: Locale }) {
  const [active, setActive] = useState(0);
  const {language}=useLocale();
  const base=content[locale];
  const c = language==="ja"?{...localizeRecord(base),steps:base.steps.map(localizeRecord)}:base;
  return <section id="how-it-works" className={styles.section} aria-labelledby="how-title">
    <div className={styles.heading}><p className={styles.eyebrow}>{c.eyebrow}</p><h2 id="how-title">{c.title.split("\n").map(line => <span key={line}>{line}</span>)}</h2><p className={styles.lead}>{c.lead}</p></div>
    <div className={styles.walkthrough}>
      <div className={styles.stepsSide}><ol className={styles.steps}>{c.steps.map((step, i) => <li key={step.title}><button type="button" className={styles.step} aria-pressed={active === i} aria-controls="how-preview" onClick={() => setActive(i)}><span className={styles.number} aria-hidden="true">0{i + 1}</span><span><strong>{step.title}</strong><span className={styles.description}>{step.description}</span></span><span className={styles.arrow} aria-hidden="true">↗</span></button></li>)}</ol><div className={styles.startLinks}><a href="/#create" className={styles.primary}>{c.cta}<span aria-hidden="true">↗</span></a><a href="/how-it-works#live-demo" className={styles.demoLink}>Live Demo <span aria-hidden="true">↗</span></a><a href="/templates" className={styles.secondary}>{c.templates}<span aria-hidden="true">→</span></a></div></div>
      <div id="how-preview" className={styles.preview} role="region" aria-label={c.region}>
        <div className={styles.previewHeader}><span className={styles.example}>{c.example}</span><span className={styles.progress}>{c.step} {active + 1} {c.of} 3</span></div>
        <div className={styles.demo} key={active}>
          <p className={styles.exampleTitle}>{c.exampleTitle}</p>
          {active === 0 ? <div className={styles.promptDemo}><span className={styles.spark} aria-hidden="true">✳</span><p className={styles.promptLabel}>{c.promptLabel}</p><p className={styles.prompt}>{c.prompt}</p><div className={styles.promptSettings}><span>{c.lifetime}</span><strong>{c.duration}</strong></div><p className={styles.demoNote}>{c.promptHint}</p></div>
          : active === 1 ? <div className={styles.shareDemo}><span className={styles.ready}><span aria-hidden="true">✓</span>{c.ready}</span><h3>{c.shareTitle}</h3><p>{c.shareLead}</p><div className={styles.linkExample}><span aria-hidden="true">↗</span><span>{c.link}</span></div><div className={styles.devices}><span>{c.phone}</span><span aria-hidden="true">↔</span><span>{c.desktop}</span></div><p className={styles.demoNote}>{c.noAccount}</p></div>
          : <div className={styles.resultsDemo}><h3>{c.resultTitle}</h3><div className={styles.resultRow}><span>{c.tea}</span><span>62%</span><meter min={0} max={100} value={62} aria-label={`${c.tea} 62%`} /></div><div className={styles.resultRow}><span>{c.coffee}</span><span>38%</span><meter min={0} max={100} value={38} aria-label={`${c.coffee} 38%`} /></div><p className={styles.demoNote}>{c.resultNote}</p><div className={styles.hostControls}><span>{c.controls}</span><div><span>{c.close}</span><span>{c.end}</span></div></div></div>}
          <p className={styles.detail}>{c.steps[active].detail}</p>
        </div>
        <div className={styles.previewFooter}><div className={styles.dots} aria-hidden="true">{c.steps.map((step, i) => <span key={step.title} className={active === i ? styles.activeDot : undefined} />)}</div><button type="button" onClick={() => setActive((active + 1) % 3)}>{active === 2 ? c.restart : c.next}<span aria-hidden="true">→</span></button></div>
      </div>
    </div>
  </section>;
}
