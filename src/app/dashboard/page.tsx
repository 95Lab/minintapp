"use client";
import { translate } from "@/lib/i18n/messages";
import { BrandTopBar } from "@/components/brand-top-bar";
import { useLocale } from "@/lib/i18n/locale-provider";
import Link from "next/link";
import { useEffect, useState } from "react";
import { requestJson } from "@/lib/api/api-client";
import type { MyAppsResponse } from "@/lib/api/api-contract-types";
export default function Dashboard() {
  const { locale } = useLocale();
  const tr = (message: Parameters<typeof translate>[1]) => translate(locale, message);
  const [apps, setApps] = useState<MyAppsResponse["apps"]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    const load = () => requestJson<MyAppsResponse>("/api/my-apps", { signal: abort.signal }).then((body) => { setApps(body.apps); setError(""); }).catch(() => { if (!abort.signal.aborted) setError(tr("Không thể tải danh sách ứng dụng.")); });
    void load(); const timer = setInterval(load, 3000);
    return () => { abort.abort(); clearInterval(timer); };
  }, []);
  async function action(id: string, value: "suspend" | "resume" | "delete") {
    if (value === "delete" && !window.confirm(tr("Xóa ứng dụng và dữ liệu riêng của ứng dụng này?"))) return;
    setBusy(id); setError("");
    try { await requestJson(`/api/apps/${id}/deployment`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: value }) }); }
    catch { setError(tr("Không thể thay đổi ứng dụng. Cần dùng trình duyệt có quyền host.")); }
    finally { setBusy(null); }
  }
  return <><BrandTopBar /><main className="component-preview"><h1>{tr("Ứng dụng của tôi")}</h1><Link href="/">{tr("Tạo ứng dụng")}</Link>
    {error && <p role="alert">{error}</p>}{!apps.length && <p>{tr("Chưa có ứng dụng trong phiên trình duyệt này.")}</p>}
    {apps.map((app) => <article className="mini-card" key={app.id}><h2>{app.id}</h2><p role="status">{app.state}</p><p>{tr("Hết hạn: ")}{new Date(app.expires_at).toLocaleString(locale === "vi" ? "vi-VN" : "en-GB")}</p>
      {app.state === "RUNNING" && <><Link href={`/rooms/${app.id}/host`}>{tr("Quản lý nội dung")}</Link>{" · "}<a href={`https://${app.hostname}/rooms/${app.id}`}>{tr("Mở ứng dụng")}</a></>}
      <div className="mini-actions">{app.state === "RUNNING" && <button disabled={busy === app.id} onClick={() => action(app.id, "suspend")}>{tr("Tạm dừng")}</button>}
        {app.state === "SUSPENDED" && <button disabled={busy === app.id} onClick={() => action(app.id, "resume")}>{tr("Chạy lại")}</button>}
        {!["DELETED", "EXPIRED"].includes(app.state) && <button disabled={busy === app.id} onClick={() => action(app.id, "delete")}>{tr("Xóa")}</button>}</div></article>)}
  </main></>;
}
