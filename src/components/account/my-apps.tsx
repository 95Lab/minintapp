import Link from "next/link";
import type { AppStatus } from "@/lib/api/api-contract-types";
export function MyApps({ apps }: { apps: readonly { id: string; title: string; status: AppStatus; href: string }[] }) {
  return <section className="mini-card"><h2>Ứng dụng của tôi</h2>{!apps.length ? <p>Chưa có ứng dụng.</p> : <ul>{apps.map((app) => <li key={app.id}><Link href={app.href.startsWith("/") && !app.href.startsWith("//") ? app.href : "/"}>{app.title}</Link> · {app.status}</li>)}</ul>}</section>;
}
