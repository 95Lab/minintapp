import { translate } from "@/lib/i18n/messages";
import { getLocale } from "@/lib/i18n/server";
import { BrandLogo } from "@/components/brand-logo";
import { SystemStatus } from "@/components/system-status";
import { SiteHeader } from "@/components/site-header";
import { GenerateAppForm } from "@/components/create/generate-app-form";
import { CreatePollButton } from "@/components/create/create-poll-button";
import { HowItWorks } from "@/components/create/how-it-works";
import { HomeMotion } from "@/components/create/home-motion";
export const dynamic = "force-dynamic";

export default async function Home() {
  const locale = await getLocale();
  const tr = (message: Parameters<typeof translate>[1]) => translate(locale, message);
const templates = [
  { id: "poll-drinks", title: tr("Cả nhóm cùng chọn"), description: tr("Chốt đồ uống, chọn địa điểm hay lấy ý kiến cho buổi hẹn tiếp theo."), label: tr("Tạo bình chọn mẫu"), kind: "poll", tag: tr("Bình chọn"), number: "01" },
  { id: "quiz-general", title: tr("Một chút thử thách"), description: tr("Khởi động workshop bằng quiz do bạn điều khiển và bật mí đáp án."), label: tr("Tạo quiz mẫu"), kind: "quiz", tag: "Quiz", number: "02" },
  { id: "wheel-participants", title: tr("Để may mắn quyết định"), description: tr("Mọi người vào phòng, ghi tên và cùng chờ người được chọn."), label: tr("Tạo bốc thăm người tham gia"), kind: "wheel", tag: tr("Bốc thăm"), number: "03" },
];
const extras = [
  { id: "compose-survey", title: tr("Lắng nghe nhiều hơn"), description: tr("Thu thập ý kiến qua nhiều trường thông tin."), label: tr("Tạo khảo sát nhiều trường"), mark: "≡" },
  { id: "compose-expenses", title: tr("Chi tiêu rõ ràng"), description: tr("Ghi lại từng khoản và theo dõi tổng chi."), label: tr("Tạo sổ chi tiêu"), mark: "₫" },
  { id: "compose-steps", title: tr("Từng bước, từng ý kiến"), description: tr("Mở câu hỏi theo nhịp buổi chia sẻ của bạn."), label: tr("Tạo khảo sát từng bước"), mark: "↳" },
  { id: "wheel-options", title: tr("Chọn gì hôm nay?"), description: tr("Đưa các lựa chọn lên vòng quay và chốt thôi."), label: tr("Tạo vòng quay lựa chọn"), mark: "↗" },
];
const faqs = [
  [tr("MinintApp dùng để làm gì?"), tr("Tạo các ứng dụng nhỏ cho nhu cầu trước mắt: bình chọn, quiz, bốc thăm, khảo sát và ghi chép chi tiêu.")],
  [tr("Bắt đầu từ mẫu hay mô tả bằng AI?"), tr("Chọn mẫu để mở ngay một ứng dụng có sẵn. Dùng ô mô tả khi bạn muốn AI tạo form, khảo sát, quiz, chia nhóm, chi tiêu hoặc mini game theo nhu cầu.")],
  [tr("Người khác tham gia bằng cách nào?"), tr("Sau khi tạo, bạn nhận link và mã QR ở trang quản lý. Gửi link hoặc để mọi người quét QR trên điện thoại.")],
  [tr("Ứng dụng tồn tại bao lâu?"), tr("Với ứng dụng tạo bằng AI, bạn chọn thời gian sử dụng là 1 giờ, 24 giờ hoặc 7 ngày trước khi tạo.")],
  [tr("Tôi có thể quản lý ứng dụng sau khi tạo không?"), tr("Có. Trang quản lý cho phép bạn đóng, mở lại hoặc kết thúc ứng dụng.")],
  [tr("Có cần AI để dùng mẫu không?"), tr("Không. Các mẫu tạo ứng dụng trực tiếp. Chỉ luồng tạo từ mô tả mới cần kết nối OpenAI được cấu hình trên hệ thống.")],
];


  return <div className="home-shell">
    <a className="skip-link" href="#main-content">{tr("Đến nội dung chính")}</a>
    <SiteHeader home />
    <main id="main-content" className="home-main">
      <section className="home-hero" aria-labelledby="hero-title">
        <div className="hero-copy"><p className="eyebrow caption-3"><span className="status-dot" />{tr("Ứng dụng nhỏ. Đúng lúc cần.")}</p><h1 id="hero-title" className="heading-1">{tr("Ý tưởng nhỏ.")}<br />{tr("Kết nối ")}<span className="hero-emphasis">{tr("cả nhóm.")}</span></h1><p className="hero-description body-3">{tr("Tạo app dùng ngay cho việc bạn cần, chỉ bằng một câu mô tả. Không cần biết code.")}</p><div className="hero-note caption-2"><span aria-hidden="true">↳</span> Temporary problem. Temporary software.</div></div>
        <div id="create" className="hero-composer"><div className="composer-top caption-3"><span className="composer-symbol" aria-hidden="true">✳</span>{tr("TỪ Ý TƯỞNG ĐẾN ỨNG DỤNG")}<span className="ai-label caption-4">AI</span></div><GenerateAppForm /><div className="composer-foot caption-2"><span aria-hidden="true">↗</span>{tr("Tạo xong, chia sẻ link để mọi người cùng tham gia.")}</div></div>
      </section>
      <div className="use-cases caption-4"><span>{tr("Dành cho những lúc")}</span><span>{tr("Họp nhóm")}</span><span>Workshop</span><span>{tr("Lớp học")}</span><span>{tr("Hẹn hò bạn bè")}</span><span className="use-case-end">{tr("Và mọi ý tưởng bất chợt ↗")}</span></div>
      <div className="hero-market"><p className="hero-use-note body-6">{tr("Bình chọn, quiz, bốc thăm hay ghi chép chi tiêu. Dùng ngay cho một buổi, một việc, rồi chia sẻ bằng đường link.")}</p><p className="body-6">{tr("App hữu ích cho bạn, biết đâu cũng hữu ích cho người khác.")}</p><a href="/templates" className="hero-market-link">{tr("Biến ý tưởng thành mẫu có thể bán? Tại sao không?")} <span aria-hidden="true">↗</span></a><span className="hero-market-note">{tr("Khám phá marketplace Free/Paid · Bản demo")}</span></div>
      <section id="templates" className="home-templates" aria-labelledby="templates-title" data-reveal><div className="section-heading"><div><p className="eyebrow caption-3">{tr("BẮT ĐẦU TỪ ĐÂY")}</p><h2 id="templates-title" className="heading-3">{tr("Có sẵn mẫu. Chọn là chạy.")}</h2></div><p className="body-6">{tr("Không cần nghĩ từ đầu.")}<br />{tr("Các mẫu sẵn sàng dùng, không cần AI.")}</p></div>
        <div className="template-grid">{templates.map((t) => <article key={t.id} className={`template-card template-${t.kind}`}><div className="template-visual" aria-hidden="true"><span className="visual-number caption-4">/{t.number}</span>{t.kind === "poll" ? <div className="poll-art"><span className="art-label caption-3">{tr("Hôm nay uống gì?")}</span><span className="poll-row">{tr("Cà phê ")}<b>↗</b></span><span className="poll-row selected">{tr("Trà sữa ")}<b>✓</b></span><span className="poll-row">Matcha <b>↗</b></span></div> : t.kind === "quiz" ? <div className="quiz-art"><span className="quiz-spark">✳</span><span className="art-label caption-3">{tr("Sẵn sàng thử sức?")}</span><div><span>A</span><span className="quiz-answer">B ✓</span><span>C</span></div></div> : <div className="wheel-art"><div className="wheel-disc"><span>✳</span></div><span className="wheel-pointer">▼</span><span className="wheel-chip caption-3">{tr("Ai sẽ được chọn?")}</span></div>}</div><div className="template-content"><span className="template-tag caption-3">{t.tag}</span><h3 className="heading-5">{t.title}</h3><p className="body-6">{t.description}</p><CreatePollButton templateId={t.id} label={t.label} /></div></article>)}</div>
        <div className="extra-grid">{extras.map((t) => <article className="extra-template" key={t.id}><span className="extra-mark heading-5" aria-hidden="true">{t.mark}</span><div><h3 className="title-3">{t.title}</h3><p className="body-6">{t.description}</p><CreatePollButton templateId={t.id} label={t.label} /></div></article>)}</div>
      </section>
      <HowItWorks locale={locale} />
      <section className="tagline-section" aria-label={tr("Thông điệp")}><p className="heading-2">{tr("Việc nhỏ có công cụ riêng.").split(" ").map((word, i) => <span className="reveal-word" key={i}>{word} </span>)}<br />{tr("Khoảnh khắc có nhau.").split(" ").map((word, i) => <span className="reveal-word" key={i}>{word} </span>)}</p><a href="#create" className="text-link button-md">{tr("Tạo ứng dụng của bạn")}<span aria-hidden="true">↗</span></a></section>
      <section className="faq-section" aria-labelledby="faq-title" data-reveal><div><p className="eyebrow caption-3">{tr("TRƯỚC KHI BẮT ĐẦU")}</p><h2 id="faq-title" className="heading-3">{tr("Bạn có thể đang thắc mắc.")}</h2></div><div className="faq-grid">{faqs.map(([q, a]) => <article key={q}><h3 className="title-3">{q}</h3><p className="body-6">{a}</p></article>)}</div></section>
    </main>
    <footer className="home-footer"><div><BrandLogo /></div><span className="caption-2">95LAB</span><SystemStatus /></footer>
    <HomeMotion />
  </div>;
}
