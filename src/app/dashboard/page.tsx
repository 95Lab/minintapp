"use client";

import Link from "next/link";
import { fetchSession } from "@/engine/auth/account-client";
import { BrandLogo } from "@/components/brand-logo";
import { useEffect, useState } from "react";
import { DeploymentManagementPanel } from "@/components/deployment-management";
import { AccountNav } from "@/engine-ui/account/account-nav";
import { LanguageSwitcher, useLocale } from "@/lib/i18n/locale-provider";
import { requestJson } from "@/lib/api/api-client";
import type { MyAppsResponse } from "@/lib/api/api-contract-types";
import styles from "./page.module.css";

export default function Dashboard() {
  const { locale } = useLocale();
  const text = (vi: string, en: string) => locale === "vi" ? vi : en;
  const [authenticated, setAuthenticated] = useState(false);
  const [authError, setAuthError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void fetchSession().then(session => {
      if (cancelled) return;
      if (!session) { setAuthError(true); return; }
      if (!session.user) { window.location.replace("/login"); return; }
      setAuthenticated(true);
    });
    return () => { cancelled = true; };
  }, []);
  const [apps, setApps] = useState<MyAppsResponse["apps"]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!authenticated) return;
    const abort = new AbortController();
    const load = () => requestJson<MyAppsResponse>("/api/my-apps", { signal: abort.signal })
      .then((body) => { setApps(body.apps); setError(""); })
      .catch(() => { if (!abort.signal.aborted) setError(locale === "vi" ? "Không thể tải danh sách ứng dụng. Vui lòng thử lại." : "Could not load your apps. Please try again."); })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    void load();
    const timer = setInterval(load, 3000);
    return () => { abort.abort(); clearInterval(timer); };
  }, [locale, retry, authenticated]);
  async function action(id: string, value: "suspend" | "resume" | "delete") {
    if (value === "delete" && !window.confirm(text("Xóa ứng dụng và dữ liệu riêng của ứng dụng này?", "Delete this app and its data?"))) return;
    setBusy(id); setError("");
    try {
      await requestJson(`/api/apps/${id}/deployment`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: value }) });
      setRetry((value) => value + 1);
    } catch { setError(text("Không thể thay đổi ứng dụng. Cần dùng trình duyệt có quyền host.", "Could not update the app. Use the browser with host access.")); }
    finally { setBusy(null); }
  }
  const labels: Record<MyAppsResponse["apps"][number]["state"], string> = {
    QUEUED: text("Đang chờ", "Queued"), GENERATING: text("Đang tạo", "Generating"), BUILDING: text("Đang build", "Building"), DEPLOYING: text("Đang triển khai", "Deploying"), RUNNING: text("Đang chạy", "Running"), FAILED: text("Có lỗi", "Failed"), SUSPENDED: text("Tạm dừng", "Paused"), EXPIRED: text("Hết hạn", "Expired"), DELETED: text("Đã xóa", "Deleted"),
  };
  const visible = apps.filter((app) => (filter === "all" || app.state === filter) && `${app.id} ${app.hostname}`.toLowerCase().includes(query.trim().toLowerCase()));
  const stats = [
    { label: text("Tổng ứng dụng", "Total apps"), value: apps.length, note: text("Trong phiên trình duyệt này", "In this browser session") },
    { label: text("Đang hoạt động", "Running"), value: apps.filter((app) => app.state === "RUNNING").length, note: text("Sẵn sàng để chia sẻ", "Ready to share") },
    { label: text("Đang triển khai", "In progress"), value: apps.filter((app) => ["QUEUED", "GENERATING", "BUILDING", "DEPLOYING"].includes(app.state)).length, note: text("Từ ý tưởng đến ứng dụng", "From idea to app") },
    { label: text("Cần chú ý", "Needs attention"), value: apps.filter((app) => ["FAILED", "EXPIRED"].includes(app.state)).length, note: text("Lỗi hoặc đã hết hạn", "Failed or expired") },
  ];
  if (!authenticated) return <main><p role="status">{authError ? text("Không thể kiểm tra đăng nhập. Vui lòng tải lại trang.", "Could not verify your session. Please reload.") : text("Đang kiểm tra đăng nhập…", "Checking your session…")}</p>{authError && <Link href="/login">{text("Đăng nhập", "Sign in")}</Link>}</main>;
  return <div className={styles.shell}>
    <a className={styles.skip} href="#dashboard-content">{text("Đến nội dung", "Skip to content")}</a>
    <aside className={styles.sidebar}>
      <BrandLogo className={styles.logo} />
      <p className={styles.caption}>{text("KHÔNG GIAN LÀM VIỆC", "WORKSPACE")}</p>
      <nav aria-label={text("Điều hướng chính", "Main navigation")}>
        <Link href="/dashboard" aria-current="page"><span aria-hidden="true">▦</span>{text("Ứng dụng của tôi", "My apps")}</Link>
        <Link href="/templates"><span aria-hidden="true">▤</span>{text("Thư viện mẫu", "Templates")}</Link>
        <Link href="/"><span aria-hidden="true">＋</span>{text("Tạo ứng dụng", "Create an app")}</Link>
      </nav>
      <div className={styles.sidebarNote}><span className={styles.noteMark} aria-hidden="true">✳</span><h2>{text("Ý tưởng nhỏ.\nKết nối lớn.", "Small ideas.\nBig connections.")}</h2><p>{text("Tạo bình chọn, quiz và trò chơi cho cuộc gặp tiếp theo.", "Make polls, quizzes and games for your next gathering.")}</p><Link href="/templates">{text("Khám phá mẫu", "Explore templates")} <span aria-hidden="true">↗</span></Link></div>
      <Link className={styles.back} href="/">← {text("Về trang chủ", "Back to home")}</Link>
    </aside>
    <div className={styles.workspace}>
      <header className={styles.topbar}><span>Workspace <span className={styles.slash}>/</span> <strong>{text("Tổng quan", "Overview")}</strong></span><div><AccountNav /><LanguageSwitcher /></div></header>
      <main id="dashboard-content" className={styles.main}>
        <div className={styles.heading}><div><p className={styles.eyebrow}>{text("TỪ Ý TƯỞNG ĐẾN TƯƠNG TÁC", "FROM IDEAS TO INTERACTION")}</p><h1>{text("Ứng dụng của tôi", "My apps")}<span>.</span></h1><p>{text("Mọi ứng dụng, một nơi quản lý. Sẵn sàng cho kết nối tiếp theo.", "All your apps, in one place. Ready for your next connection.")}</p></div><Link className={styles.primary} href="/"><span aria-hidden="true">＋</span> {text("Tạo ứng dụng", "Create an app")}</Link></div>
        <section className={styles.stats} aria-label={text("Tổng quan ứng dụng", "App overview")}>{stats.map((stat, index) => <div className={styles.stat} key={stat.label}><div><span>{stat.label}</span><span className={styles.statSymbol} aria-hidden="true">{["▦", "↗", "◷", "!"][index]}</span></div><strong>{loading ? "—" : stat.value.toString().padStart(2, "0")}</strong><p>{stat.note}</p></div>)}</section>
        <section className={styles.apps} aria-labelledby="apps-heading"><div className={styles.listHeading}><h2 id="apps-heading">{text("Tất cả ứng dụng", "All apps")} <span>{apps.length}</span></h2><span className={styles.session}>{text("Lưu theo phiên trình duyệt", "Saved in this browser")}</span></div>
          <div className={styles.toolbar}><label className={styles.search}><span aria-hidden="true">⌕</span><input type="search" aria-label={text("Tìm theo mã hoặc tên miền", "Search by ID or hostname")} placeholder={text("Tìm theo mã hoặc tên miền...", "Search by ID or hostname...")} value={query} onChange={(event) => setQuery(event.target.value)} /></label><label className={styles.filter}>{text("Trạng thái", "Status")}<select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">{text("Tất cả", "All")}</option>{Object.entries(labels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div>
          {error && <div className={styles.error} role="alert">{error}<button onClick={() => setRetry((value) => value + 1)}>{text("Thử lại", "Retry")}</button></div>}
          {loading ? <div className={styles.skeleton} role="status" aria-label={text("Đang tải ứng dụng", "Loading apps")}><div /><div /><div /></div> : !visible.length ? <div className={styles.empty}><div className={styles.emptyArt} aria-hidden="true"><span>▦</span><span>＋</span></div><p className={styles.eyebrow}> {text("MỘT Ý TƯỞNG LÀ ĐỦ ĐỂ BẮT ĐẦU", "ONE IDEA IS ALL IT TAKES")}</p><h3>{apps.length ? text("Không tìm thấy ứng dụng", "No matching apps") : text("Không gian cho ý tưởng đầu tiên", "A space for your first idea")}</h3><p>{apps.length ? text("Thử tìm mã khác hoặc thay đổi bộ lọc trạng thái.", "Try another ID or change the status filter.") : text("Chưa có ứng dụng trong phiên trình duyệt này. Bắt đầu với một mẫu có sẵn hoặc mô tả ý tưởng của bạn.", "No apps in this browser session yet. Start with a template or describe your idea.")}</p>{apps.length ? <button onClick={() => { setQuery(""); setFilter("all"); }}>{text("Xóa bộ lọc", "Clear filters")}</button> : <Link className={styles.primary} href="/templates">{text("Chọn mẫu để bắt đầu", "Start with a template")} <span aria-hidden="true">↗</span></Link>}</div> : <div className={styles.list}>{visible.map((app) => <article className={styles.card} key={app.id}><div className={styles.cardHeader}><div className={styles.appIcon} aria-hidden="true">▦</div><div className={styles.appIdentity}><h3>{app.hostname || app.id}</h3><p>{app.id}</p></div><span className={styles.badge} data-state={app.state}>{labels[app.state]}</span></div><p className={styles.expiry}>{text("Hết hạn: ", "Expires: ")}{new Date(app.expires_at).toLocaleString(locale === "vi" ? "vi-VN" : "en-GB")}</p><div className={styles.actions}>{app.state === "RUNNING" && <><Link href={`/rooms/${app.id}/host`}>{text("Quản lý nội dung", "Manage content")} ↗</Link><a href={`https://${app.hostname}/rooms/${app.id}`}>{text("Mở ứng dụng", "Open app")}</a><button disabled={busy === app.id} onClick={() => action(app.id, "suspend")}>{text("Tạm dừng", "Pause")}</button></>}{app.state === "SUSPENDED" && <button disabled={busy === app.id} onClick={() => action(app.id, "resume")}>{text("Chạy lại", "Resume")}</button>}{!["DELETED", "EXPIRED"].includes(app.state) && <button className={styles.danger} disabled={busy === app.id} onClick={() => action(app.id, "delete")}>{text("Xóa", "Delete")}</button>}</div>{app.state !== "DELETED" && <div className={styles.details}><DeploymentManagementPanel id={app.id} /></div>}</article>)}</div>}
        </section>
        <footer className={styles.footer}><span>minintapp<span className={styles.period}>.</span></span><p>{text("Nhỏ gọn để tạo. Dễ dàng kết nối.", "Simple to create. Made to connect.")}</p><Link href="/templates">{text("Tìm cảm hứng từ thư viện mẫu", "Find inspiration in templates")} ↗</Link></footer>
      </main>
    </div>
  </div>;
}
