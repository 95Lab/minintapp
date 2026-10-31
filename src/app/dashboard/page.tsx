"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { requestJson } from "@/lib/api/api-client";
import type { MyAppsResponse } from "@/lib/api/api-contract-types";
export default function Dashboard() {
  const [apps, setApps] = useState<MyAppsResponse["apps"]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    const load = () => requestJson<MyAppsResponse>("/api/my-apps", { signal: abort.signal }).then((body) => { setApps(body.apps); setError(""); }).catch(() => { if (!abort.signal.aborted) setError("Không thể tải danh sách ứng dụng."); });
    void load(); const timer = setInterval(load, 3000);
    return () => { abort.abort(); clearInterval(timer); };
  }, []);
  async function action(id: string, value: "suspend" | "resume" | "delete") {
    if (value === "delete" && !window.confirm("Xóa ứng dụng và dữ liệu riêng của ứng dụng này?")) return;
    setBusy(id); setError("");
    try { await requestJson(`/api/apps/${id}/deployment`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: value }) }); }
    catch { setError("Không thể thay đổi ứng dụng. Cần dùng trình duyệt có quyền host."); }
    finally { setBusy(null); }
  }
  return <main className="component-preview"><h1>Ứng dụng của tôi</h1><Link href="/">Tạo ứng dụng</Link>
    {error && <p role="alert">{error}</p>}{!apps.length && <p>Chưa có ứng dụng trong phiên trình duyệt này.</p>}
    {apps.map((app) => <article className="mini-card" key={app.id}><h2>{app.id}</h2><p role="status">{app.state}</p><p>Hết hạn: {new Date(app.expires_at).toLocaleString("vi-VN")}</p>
      {app.state === "RUNNING" && <><Link href={`/a/${app.id}/host`}>Quản lý nội dung</Link>{" · "}<a href={`https://${app.hostname}/a/${app.id}`}>Mở ứng dụng</a></>}
      <div className="mini-actions">{app.state === "RUNNING" && <button disabled={busy === app.id} onClick={() => action(app.id, "suspend")}>Tạm dừng</button>}
        {app.state === "SUSPENDED" && <button disabled={busy === app.id} onClick={() => action(app.id, "resume")}>Chạy lại</button>}
        {!["DELETED", "EXPIRED"].includes(app.state) && <button disabled={busy === app.id} onClick={() => action(app.id, "delete")}>Xóa</button>}</div></article>)}
  </main>;
}
