import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ứng dụng của tôi | MinintApp",
  description: "Quản lý ứng dụng, trạng thái triển khai và nội dung của bạn trên MinintApp.",
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
