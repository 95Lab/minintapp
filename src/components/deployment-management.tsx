"use client";
import { useEffect, useState } from "react";
import { requestJson } from "@/lib/api/api-client";
import { DeploymentManagementSchema, type DeploymentManagement, type DeploymentAction } from "@/lib/api/deployment-management-contract";
import { useLocale } from "@/lib/i18n/locale-provider";
export function DeploymentManagementPanel({ id }: { id: string }) {
  const { locale } = useLocale();
  const text = (vi: string, en: string) => locale === "vi" ? vi : en;
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState<DeploymentManagement | null>(null);
  const [image, setImage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const url = `/api/apps/${id}/deployment`;
  async function load(signal?: AbortSignal) {
    const body = DeploymentManagementSchema.parse(await requestJson(`${url}?details=1`, { signal }));
    if (!signal?.aborted) { setDetails(body); setError(false); }
  }
  useEffect(() => {
    if (!open) return;
    const abort = new AbortController();
    const refresh = () => { void load(abort.signal).catch(() => { if (!abort.signal.aborted) setError(true); }); };
    refresh(); const timer = setInterval(refresh, 5000);
    return () => { abort.abort(); clearInterval(timer); };
  }, [open, id]);
  async function submit(action: DeploymentAction) {
    setBusy(true); setError(false);
    try {
      await requestJson(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action) });
      setImage(""); await load();
    } catch { setError(true); }
    finally { setBusy(false); }
  }
  const active = details?.versions.find(version => version.version === details.activeVersion);
  const canChange = !busy && details?.state === "RUNNING" && !details.requestedVersion && !!active;
  return <section aria-label={text("Phiên bản và log", "Versions and logs")}>
    <button aria-expanded={open} onClick={() => setOpen(value => !value)}>{text("Phiên bản và log", "Versions and logs")}</button>
    {open && <div>
      {error && <p role="alert">{text("Không thể tải hoặc thay đổi phiên bản. Hãy làm mới và kiểm tra quyền host, trạng thái Worker.", "Unable to load or change versions. Refresh and check host access and worker status.")}</p>}
      {!details && !error && <p role="status">{text("Đang tải…", "Loading…")}</p>}
      {details && <>
        <p>{text("Phiên bản đang chạy: ", "Active version: ")}{details.activeVersion ? `v${details.activeVersion}` : "—"}
          {details.requestedVersion && ` · ${text("Đang triển khai", "Deploying")} v${details.requestedVersion}`}</p>
        <p>{text("Đổi phiên bản sẽ khởi động lại app trong thời gian ngắn. Rollback giữ nguyên dữ liệu và câu trả lời hiện tại.", "Changing versions briefly restarts the app. Rollback preserves current data and responses.")}</p>
        <label className="mini-field" style={{ display: "block" }}>{text("Image đã duyệt", "Approved image")}{" "}<select value={image} onChange={event => setImage(event.target.value)} disabled={!canChange}>
          <option value="">{text("Chọn phiên bản runtime", "Choose a runtime version")}</option>
          {details.images.filter(value => value !== active?.image).map(value => <option value={value} key={value}>sha256:{value.split("@sha256:")[1]?.slice(0,12)}</option>)}
        </select></label>{" "}
        <button disabled={!canChange || !image || !details.images.includes(image)} onClick={() => { if (details.activeVersion) void submit({ action: "deploy", image, expectedVersion: details.activeVersion }); }}>{text("Triển khai phiên bản", "Deploy version")}</button>
        <div style={{ overflowX: "auto" }}><table><caption>{text("Lịch sử phiên bản", "Version history")}</caption>
          <thead><tr><th>{text("Phiên bản", "Version")}</th><th>Image</th><th>{text("Trạng thái", "Status")}</th><th>{text("Thời gian", "Time")}</th><th>Rollback</th></tr></thead>
          <tbody>{details.versions.map(version => <tr key={version.version}>
            <td>v{version.version}{version.rollbackOf && ` ← v${version.rollbackOf}`}{version.version === details.activeVersion && ` (${text("đang chạy", "active")})`}</td>
            <td><code title={version.image}>{version.image.split("@sha256:")[1]?.slice(0,12)}</code></td>
            <td>{version.status}</td><td>{new Date(version.createdAt).toLocaleString(locale === "vi" ? "vi-VN" : "en-GB")}</td>
            <td>{version.status === "SUCCEEDED" && version.image !== active?.image && <button disabled={!canChange || !details.images.includes(version.image)} onClick={() => { if (details.activeVersion) void submit({ action: "rollback", version: version.version, expectedVersion: details.activeVersion }); }}>{text("Quay về", "Restore")} v{version.version}</button>}</td>
          </tr>)}</tbody>
        </table></div>
        <h3>{text("Nhật ký ứng dụng", "Application logs")}</h3>
        {!details.runtimeLogsAvailable && <p role="status">{text("Log runtime hiện không khả dụng; đang hiển thị log đã lưu.", "Live runtime logs unavailable; showing stored logs.")}</p>}
        <pre aria-label={text("Nhật ký ứng dụng", "Application logs")} style={{ maxHeight: "24rem", overflow: "auto", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{details.logs.map(log => `${log.at} [${log.source}] ${log.message}`).join("\n") || text("Chưa có log.", "No logs yet.")}</pre>
        <button onClick={() => { void load().catch(() => setError(true)); }}>{text("Làm mới log và phiên bản", "Refresh logs and versions")}</button>
      </>}
    </div>}
  </section>;
}
