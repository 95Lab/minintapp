import Link from "next/link";
export function AccountNav({ email, enabled = false }: { email?: string | null; enabled?: boolean }) {
  if (!enabled) return <span className="mini-badge">Tài khoản chưa khả dụng</span>;
  return <nav aria-label="Tài khoản">{email ? <Link href="/my-apps">Ứng dụng của tôi · {email}</Link> : <Link href="/login">Đăng nhập</Link>}</nav>;
}
