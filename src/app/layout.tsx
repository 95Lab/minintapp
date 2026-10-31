export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "MinintApp · Ứng dụng nhỏ, kết nối cả nhóm", description: "Tạo bình chọn, quiz, bốc thăm và khảo sát cho nhóm của bạn. Bắt đầu từ mẫu hoặc mô tả ý tưởng, rồi chia sẻ bằng link và mã QR." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body>{children}</body></html>;
}
