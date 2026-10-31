import { readRuntimeConfig } from "@/lib/config/runtime-config";
export const dynamic = "force-dynamic";
import { GenerateAppForm } from "@/components/create/generate-app-form";
import { CreatePollButton } from "@/components/create/create-poll-button";
export default function Home() {
  const persistent = readRuntimeConfig().APP_STORAGE === "supabase";
  return <main className="component-preview"><p className="brand">95LAB / MININTAPP</p><h1>MinintApp</h1>
    <p>Temporary problem. Temporary software.</p>
    <GenerateAppForm />
    <section className="mini-card" aria-label="Bắt đầu bình chọn"><h2>Tạo ứng dụng và chia sẻ ngay</h2>
      <p>Bắt đầu với bình chọn, quiz hoặc bốc thăm. Mở link trên các thiết bị để tham gia và xem kết quả cập nhật.</p>
      <div className="mini-actions"><CreatePollButton templateId="compose-survey" label="Tạo khảo sát nhiều trường" /><CreatePollButton templateId="compose-expenses" label="Tạo sổ chi tiêu" /><CreatePollButton templateId="compose-steps" label="Tạo khảo sát từng bước" /><CreatePollButton /><CreatePollButton templateId="quiz-general" label="Tạo quiz mẫu" /><CreatePollButton templateId="wheel-participants" label="Tạo bốc thăm người tham gia" /><CreatePollButton templateId="wheel-options" label="Tạo vòng quay lựa chọn" /></div>
      <p>{persistent ? "Lưu bền trên Supabase và đồng bộ Realtime giữa các thiết bị." : "Chế độ memory: dữ liệu mất khi server khởi động lại."} Các mẫu không gọi AI.</p>
      <p><a href="/preview">Xem thư viện component</a></p>
      <a href="/api/health">Kiểm tra trạng thái hệ thống</a>
    </section></main>;
}
