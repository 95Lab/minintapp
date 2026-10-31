import Link from "next/link";
export function BrandTopBar({ children }: { children?: React.ReactNode }) {
  return <header className="mini-topbar"><Link href="/" aria-label="Trang chủ MinintApp">MinintApp</Link><nav aria-label="Điều hướng chính">{children}</nav></header>;
}
