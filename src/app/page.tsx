import { readRuntimeConfig } from "@/lib/config/runtime-config";
import { GenerateAppForm } from "@/components/create/generate-app-form";
import { CreatePollButton } from "@/components/create/create-poll-button";
import { HomeMotion } from "@/components/create/home-motion";
export const dynamic = "force-dynamic";

const templates = [
  { id: "poll-drinks", title: "Cả nhóm cùng chọn", description: "Chốt đồ uống, chọn địa điểm hay lấy ý kiến cho buổi hẹn tiếp theo.", label: "Tạo bình chọn mẫu", kind: "poll", tag: "Bình chọn", number: "01" },
  { id: "quiz-general", title: "Một chút thử thách", description: "Khởi động workshop bằng quiz do bạn điều khiển và bật mí đáp án.", label: "Tạo quiz mẫu", kind: "quiz", tag: "Quiz", number: "02" },
  { id: "wheel-participants", title: "Để may mắn quyết định", description: "Mọi người vào phòng, ghi tên và cùng chờ người được chọn.", label: "Tạo bốc thăm người tham gia", kind: "wheel", tag: "Bốc thăm", number: "03" },
];
const extras = [
  { id: "compose-survey", title: "Lắng nghe nhiều hơn", description: "Thu thập ý kiến qua nhiều trường thông tin.", label: "Tạo khảo sát nhiều trường", mark: "≡" },
  { id: "compose-expenses", title: "Chi tiêu rõ ràng", description: "Ghi lại từng khoản và theo dõi tổng chi.", label: "Tạo sổ chi tiêu", mark: "₫" },
  { id: "compose-steps", title: "Từng bước, từng ý kiến", description: "Mở câu hỏi theo nhịp buổi chia sẻ của bạn.", label: "Tạo khảo sát từng bước", mark: "↳" },
  { id: "wheel-options", title: "Chọn gì hôm nay?", description: "Đưa các lựa chọn lên vòng quay và chốt thôi.", label: "Tạo vòng quay lựa chọn", mark: "↗" },
];
const faqs = [
  ["MinintApp dùng để làm gì?", "Tạo các ứng dụng nhỏ cho nhu cầu trước mắt: bình chọn, quiz, bốc thăm, khảo sát và ghi chép chi tiêu."],
  ["Bắt đầu từ mẫu hay mô tả bằng AI?", "Chọn mẫu để mở ngay một ứng dụng có sẵn. Dùng ô mô tả khi bạn muốn AI tạo form, khảo sát, quiz, chia nhóm, chi tiêu hoặc mini game theo nhu cầu."],
  ["Người khác tham gia bằng cách nào?", "Sau khi tạo, bạn nhận link và mã QR ở trang quản lý. Gửi link hoặc để mọi người quét QR trên điện thoại."],
  ["Ứng dụng tồn tại bao lâu?", "Với ứng dụng tạo bằng AI, bạn chọn thời gian sử dụng là 1 giờ, 24 giờ hoặc 7 ngày trước khi tạo."],
  ["Tôi có thể điều khiển buổi chơi không?", "Có. Trang quản lý cho phép chủ phòng đóng, mở lại hoặc kết thúc ứng dụng. Quiz và bốc thăm có các thao tác riêng."],
  ["Có cần AI để dùng mẫu không?", "Không. Các mẫu tạo ứng dụng trực tiếp. Chỉ luồng tạo từ mô tả mới cần kết nối OpenAI được cấu hình trên hệ thống."],
];

export default function Home() {
  const persistent = process.env.PLATFORM_ROLE === "control" || readRuntimeConfig().APP_STORAGE === "supabase";
  return <div className="home-shell">
    <a className="skip-link" href="#main-content">Đến nội dung chính</a>
    <header className="home-header"><a className="home-logo title-1" href="/" aria-label="MinintApp, trang chủ"><span className="logo-mark" aria-hidden="true">m<span>·</span></span>minintapp<span className="logo-period">.</span></a><nav aria-label="Điều hướng chính"><a className="title-4" href="/templates">Khám phá tất cả mẫu</a><a className="title-4" href="/my-apps">Ứng dụng của tôi</a><a className="title-4" href="#how-it-works">Cách hoạt động</a></nav><a className="nav-create button-sm" href="#create">Tạo ứng dụng <span aria-hidden="true">↗</span></a></header>
    <main id="main-content" className="home-main">
      <section className="home-hero" aria-labelledby="hero-title">
        <div className="hero-copy"><p className="eyebrow caption-3"><span className="status-dot" />Ứng dụng nhỏ. Đúng lúc cần.</p><h1 id="hero-title" className="heading-1">Ý tưởng nhỏ.<br />Kết nối <span className="hero-emphasis">cả nhóm.</span></h1><p className="hero-description body-3">Một cuộc bình chọn, một trò quiz, một lần bốc thăm.<br className="desktop-break" /> Tạo ứng dụng cho khoảnh khắc của bạn, rồi chia sẻ bằng một đường link.</p><div className="hero-note caption-2"><span aria-hidden="true">↳</span> Temporary problem. Temporary software.</div></div>
        <div id="create" className="hero-composer"><div className="composer-top caption-3"><span className="composer-symbol" aria-hidden="true">✳</span> TỪ Ý TƯỞNG ĐẾN ỨNG DỤNG<span className="ai-label caption-4">OpenAI</span></div><GenerateAppForm /><div className="composer-foot caption-2"><span aria-hidden="true">↗</span> Tạo xong, chia sẻ link để mọi người cùng tham gia.</div></div>
      </section>
      <div className="use-cases caption-4"><span>Dành cho những lúc</span><span>Họp nhóm</span><span>Workshop</span><span>Lớp học</span><span>Hẹn hò bạn bè</span><span className="use-case-end">Và mọi ý tưởng bất chợt ↗</span></div>
      <section id="templates" className="home-templates" aria-labelledby="templates-title" data-reveal><div className="section-heading"><div><p className="eyebrow caption-3">BẮT ĐẦU TỪ ĐÂY</p><h2 id="templates-title" className="heading-3">Có sẵn mẫu. Chọn là chạy.</h2></div><p className="body-6">Không cần nghĩ từ đầu.<br />Các mẫu sẵn sàng dùng, không cần AI.</p></div>
        <div className="template-grid">{templates.map((t) => <article key={t.id} className={`template-card template-${t.kind}`}><div className="template-visual" aria-hidden="true"><span className="visual-number caption-4">/{t.number}</span>{t.kind === "poll" ? <div className="poll-art"><span className="art-label caption-3">Hôm nay uống gì?</span><span className="poll-row">Cà phê <b>↗</b></span><span className="poll-row selected">Trà sữa <b>✓</b></span><span className="poll-row">Matcha <b>↗</b></span></div> : t.kind === "quiz" ? <div className="quiz-art"><span className="quiz-spark">✳</span><span className="art-label caption-3">Sẵn sàng thử sức?</span><div><span>A</span><span className="quiz-answer">B ✓</span><span>C</span></div></div> : <div className="wheel-art"><div className="wheel-disc"><span>✳</span></div><span className="wheel-pointer">▼</span><span className="wheel-chip caption-3">Ai sẽ được chọn?</span></div>}</div><div className="template-content"><span className="template-tag caption-3">{t.tag}</span><h3 className="heading-5">{t.title}</h3><p className="body-6">{t.description}</p><CreatePollButton templateId={t.id} label={t.label} /></div></article>)}</div>
        <div className="extra-grid">{extras.map((t) => <article className="extra-template" key={t.id}><span className="extra-mark heading-5" aria-hidden="true">{t.mark}</span><div><h3 className="title-3">{t.title}</h3><p className="body-6">{t.description}</p><CreatePollButton templateId={t.id} label={t.label} /></div></article>)}</div>
      </section>
      <section id="how-it-works" className="how-section" aria-labelledby="how-title" data-reveal><div><p className="eyebrow caption-3">ÍT THAO TÁC. NHIỀU KẾT NỐI.</p><h2 id="how-title" className="heading-3">Bạn có ý tưởng.<br />Cả nhóm có chỗ tham gia.</h2><p className="body-3">Không cần xây cả một hệ thống<br />cho một việc chỉ cần làm hôm nay.</p></div><ol className="how-steps">{[["Tạo theo cách của bạn", "Mô tả nhu cầu bằng một câu, hoặc chọn một mẫu có sẵn."], ["Gửi link, mời cả nhóm", "Chia sẻ đường link hoặc mã QR. Mở trên điện thoại hay máy tính đều được."], ["Cùng tham gia, xem kết quả", "Điều khiển ứng dụng từ trang quản lý và theo dõi câu trả lời cập nhật."]].map(([title, description], i) => <li key={title}><span className="step-number caption-3">0{i + 1}</span><div><h3 className="title-2">{title}</h3><p className="body-6">{description}</p></div></li>)}</ol></section>
      <section className="tagline-section" aria-label="Thông điệp"><p className="heading-2">{"Việc nhỏ có công cụ riêng.".split(" ").map((word, i) => <span className="reveal-word" key={i}>{word} </span>)}<br />{"Khoảnh khắc có nhau.".split(" ").map((word, i) => <span className="reveal-word" key={i}>{word} </span>)}</p><a href="#create" className="text-link button-md">Tạo ứng dụng của bạn <span aria-hidden="true">↗</span></a></section>
      <section className="faq-section" aria-labelledby="faq-title" data-reveal><div><p className="eyebrow caption-3">TRƯỚC KHI BẮT ĐẦU</p><h2 id="faq-title" className="heading-3">Bạn có thể đang thắc mắc.</h2></div><div className="faq-grid">{faqs.map(([q, a]) => <article key={q}><h3 className="title-3">{q}</h3><p className="body-6">{a}</p></article>)}</div></section>
    </main>
    <footer className="home-footer"><div><a className="title-1" href="/">minintapp.</a><p className="caption-2">Một sản phẩm từ 95LAB. Cho những nhu cầu vừa đủ.</p></div><div className="footer-links caption-2"><a href="/dashboard">Ứng dụng của tôi</a><a href="/preview">Thư viện component</a><a href="/api/health">Kiểm tra trạng thái hệ thống</a></div><p className="storage-note caption-5">{persistent ? "Dữ liệu được lưu bền và đồng bộ giữa các thiết bị." : "Phiên dùng thử: dữ liệu được lưu tạm và có thể mất khi hệ thống khởi động lại."}</p></footer>
    <HomeMotion />
  </div>;
}
