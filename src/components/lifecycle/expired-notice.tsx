import Link from "next/link";
export function ExpiredNotice({ title, reason = "expired" }: { title?: string; reason?: "expired" | "ended" | "blocked" | "not_found" | "unavailable" }) {
  const messages = { unavailable: "Ứng dụng đã hết hạn, kết thúc hoặc bị chặn.", expired: "Ứng dụng đã hết hạn.", ended: "Ứng dụng đã kết thúc.", blocked: "Ứng dụng đã bị chặn.", not_found: "Không tìm thấy ứng dụng." };
  return <section className="mini-card"><h2>{title ?? "Ứng dụng không còn hoạt động"}</h2><p>{messages[reason]}</p><Link href="/">Về trang chủ</Link></section>;
}
