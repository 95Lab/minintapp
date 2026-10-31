export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import "./globals.css";
import { getLocale } from "@/lib/i18n/server";
import { LocaleProvider } from "@/lib/i18n/locale-provider";
const viMetadata: Metadata = { title: "MinintApp · Ứng dụng nhỏ, kết nối cả nhóm", description: "Tạo bình chọn, quiz, bốc thăm và khảo sát cho nhóm của bạn. Bắt đầu từ mẫu hoặc mô tả ý tưởng, rồi chia sẻ bằng link và mã QR." };
export async function generateMetadata(): Promise<Metadata> {
  return await getLocale() === "en" ? { title: "MinintApp · Small apps, bringing groups together", description: "Create polls, quizzes, draws and surveys for your group. Start with a template or describe an idea, then share a link or QR code." } : viMetadata;
}
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  let platformOrigin = "";
  if (process.env.PLATFORM_ROLE === "runtime" && process.env.APP_ORIGIN && process.env.RUNTIME_APP_ID) {
    const origin = new URL(process.env.APP_ORIGIN);
    const prefix = `${process.env.RUNTIME_APP_ID}.`;
    if (origin.hostname.startsWith(prefix)) { origin.hostname = origin.hostname.slice(prefix.length); platformOrigin = origin.origin; }
  }
  return <html lang={locale}><body><LocaleProvider initialLocale={locale} platformOrigin={platformOrigin}>{children}</LocaleProvider></body></html>;
}
