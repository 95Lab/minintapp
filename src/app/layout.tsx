import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "MinintApp", description: "Temporary problem. Temporary software." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body>{children}</body></html>;
}
