import { CreatePollButton } from "@/components/create/create-poll-button";
export default function Home() {
  return <main className="component-preview"><p className="brand">95LAB / MININTAPP</p><h1>MinintApp</h1>
    <p>Temporary problem. Temporary software.</p>
    <section className="mini-card" aria-label="Bắt đầu bình chọn"><h2>Tạo bình chọn và chia sẻ ngay</h2>
      <p>Bắt đầu với mẫu chọn đồ uống. Mở link trên các thiết bị để gửi vote và xem kết quả cập nhật.</p>
      <CreatePollButton />
      <p>Chế độ memory: dữ liệu mất khi server khởi động lại. Chưa dùng AI hoặc Supabase.</p>
      <p><a href="/preview">Xem thư viện component</a></p>
      <a href="/api/health">Kiểm tra trạng thái hệ thống</a>
    </section></main>;
}
