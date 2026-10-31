import { GenerateAppForm } from "@/components/create/generate-app-form";
import { CreatePollButton } from "@/components/create/create-poll-button";
export const dynamic = "force-dynamic";
export default function Home() {
  return <main className="component-preview"><p className="brand">95LAB / MININTAPP</p><h1>MinintApp</h1>
    <p>Temporary problem. Temporary software.</p>
    <GenerateAppForm />
    <section className="mini-card" aria-label="Bắt đầu bình chọn"><h2>Tạo ứng dụng và chia sẻ ngay</h2>
      <p>Bắt đầu với bình chọn, quiz hoặc bốc thăm. Mở link trên các thiết bị để tham gia và xem kết quả cập nhật.</p>
      <div className="mini-actions"><CreatePollButton /><CreatePollButton templateId="quiz-general" label="Tạo quiz mẫu" /><CreatePollButton templateId="wheel-participants" label="Tạo bốc thăm người tham gia" /><CreatePollButton templateId="wheel-options" label="Tạo vòng quay lựa chọn" /></div>
      <p>{process.env.PLATFORM_ROLE === "control" ? "Mỗi ứng dụng chạy riêng và giữ dữ liệu theo thời hạn đã chọn. Các mẫu không gọi AI." : "Chế độ dùng thử: dữ liệu mất khi server khởi động lại. Các mẫu không gọi AI."}</p>
      <p><a href="/dashboard">Ứng dụng của tôi</a>{" · "}<a href="/preview">Xem thư viện component</a></p>
      <a href="/api/health">Kiểm tra trạng thái hệ thống</a>
    </section></main>;
}
