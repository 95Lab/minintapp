"use client";
import { apiErrorMessage } from "@/lib/i18n/api-error-message";
import { useLocale } from "@/lib/i18n/locale-provider";
import { RuntimeLocaleProvider, useRuntimeTranslation } from "@/lib/i18n/runtime-locale";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getParticipantToken } from "@/lib/participant/participant-token";
import { useAppState } from "@/lib/realtime/use-app-state";
import { ApiClientError, sendVote, changeLifecycle, sendBlockAction } from "@/lib/api/api-client";
import { BrandTopBar } from "./brand-top-bar";
import { AppRendererParticipant } from "./app-renderer-participant";
import { AppRendererHost } from "./app-renderer-host";
import { AppResults } from "./blocks/app-results";
import { SharePanelQr } from "./share/share-panel-qr";
import { ExpiryCountdown } from "./lifecycle/expiry-countdown";
import { ExpiredNotice } from "./lifecycle/expired-notice";
export function PollRoom({ id, host = false }: { id: string; host?: boolean }) {
  const { locale: uiLocale } = useLocale();
  const [displayName, setDisplayName] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [storageError, setStorageError] = useState("");
  const [origin, setOrigin] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const { state, error, failureStatus, refresh } = useAppState(id, host, token, uiLocale);
  const locale = state?.spec.locale ?? uiLocale;
  const tr = useRuntimeTranslation(locale);
  useEffect(() => {
    setOrigin(window.location.origin);
    if (!host) {
      try { setToken(getParticipantToken(id)); setDisplayName(localStorage.getItem(`minint_name_${id}`) ?? ""); }
      catch { setStorageError(tr("Cần cho phép lưu trữ của trình duyệt để giữ danh tính và đổi vote.")); }
    }
  }, [id, host]);
  async function transition(action: "close" | "reopen" | "end") {
    if (busy || !state?.isHost) return;
    if (action === "end" && !window.confirm(tr("Kết thúc và xoá toàn bộ câu trả lời? Thao tác này không thể hoàn tác."))) return;
    setBusy(true); setActionError("");
    try { await changeLifecycle(id, action); await refresh(); }
    catch (error) { setActionError(apiErrorMessage(error, locale, tr("Không thể thay đổi trạng thái ứng dụng."))); }
    finally { setBusy(false); }
  }
  const pollOnly = state?.spec.blocks.every((block) => block.type === "compose" && block.inputs.length === 1 && block.inputs[0].kind === "choice" && block.entries === "one" && block.flow === "open");
  if (failureStatus === 404 || failureStatus === 410) return <RuntimeLocaleProvider locale={locale}><main className="component-preview"><ExpiredNotice locale={locale} reason={failureStatus === 404 ? "not_found" : "unavailable"} /></main></RuntimeLocaleProvider>;
  if (failureStatus === 403) return <RuntimeLocaleProvider locale={locale}><main className="component-preview"><h1>{tr("Không có quyền host")}</h1><p>{tr("Hãy mở bằng trình duyệt đã tạo ứng dụng. Liên kết host không tự cấp quyền điều khiển.")}</p><Link href={`/a/${id}`}>{tr("Tham gia ứng dụng")}</Link></main></RuntimeLocaleProvider>;
  return <RuntimeLocaleProvider locale={locale}><main className="component-preview" lang={locale}><BrandTopBar /><p className="mini-notice">{state?.storage === "sqlite" ? tr("Dữ liệu được giữ theo thời hạn của ứng dụng.") : state?.sync?.mode === "supabase" ? tr("Dữ liệu được lưu trên Supabase · đồng bộ Realtime.") : state ? tr("Chế độ memory: dữ liệu tạm thời, mất khi server khởi động lại.") : tr("Đang kết nối ứng dụng…")}</p>{storageError && <p role="alert">{storageError}</p>}{error && <p role="alert">{error}</p>}{actionError && <p role="alert">{actionError}</p>}{!state && !storageError && <p role="status">{tr("Đang tải ứng dụng…")}</p>}{state && <div className="mini-app"><ExpiryCountdown expiresAt={state.expiresAt} />{host ? <><AppRendererHost spec={state.spec} runtime={state.runtime} blockResults={state.results} canControl={state.isHost && state.status === "active" && !error && !busy} busy={busy} onAction={async (blockId, action, args) => {
    setBusy(true); setActionError("");
    try { await sendBlockAction(id, blockId, action, args); await refresh(); }
    catch (error) { setActionError(apiErrorMessage(error, locale, tr("Không thể điều khiển ứng dụng."))); throw error; }
    finally { setBusy(false); }
  }} results={<AppResults state={state} />} /><div className="mini-actions"><button disabled={busy || !!error} onClick={() => transition(state.status === "active" ? "close" : "reopen")}>{state.status === "active" ? (pollOnly ? tr("Đóng bình chọn") : tr("Đóng ứng dụng")) : (pollOnly ? tr("Mở lại bình chọn") : tr("Mở lại ứng dụng"))}</button><button disabled={busy || !!error} onClick={() => transition("end")}>{tr("Kết thúc và xoá dữ liệu")}</button></div><p role="status">{state.status === "active" ? tr("Đang nhận câu trả lời") : tr("Đã đóng nhận câu trả lời")}</p>{origin && <SharePanelQr url={state.shareUrl || `${origin}/a/${id}`} />}<a href={`/api/apps/${id}/upgrade`}>{tr("Mở đầy đủ công cụ quản lý, export và remix")}</a><Link href={`/a/${id}`}>{tr("Mở trang participant")}</Link></> : <>{state.spec.requireName && !displayName && <form className="mini-card" onSubmit={(event) => {
    event.preventDefault(); const name = nameDraft.trim(); if (!name) return;
    try { localStorage.setItem(`minint_name_${id}`, name); setDisplayName(name); }
    catch { setStorageError(tr("Không thể lưu tên trong trình duyệt.")); }
  }}><label className="mini-field">{tr("Tên hiển thị")}<input required maxLength={40} value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} /></label><button>{tr("Tham gia ứng dụng")}</button></form>}<AppRendererParticipant spec={state.spec} runtime={state.runtime} displayName={displayName} blockResults={state.results} open={state.status === "active" && !error} myAnswers={state.myAnswers} onSubmit={token ? async (blockId, itemId, payload) => {
    setActionError("");
    try { await sendVote(id, { blockId, itemId, participantToken: token, displayName: displayName || null, payload }); await refresh(); return true; }
    catch (error) { setActionError(apiErrorMessage(error, locale, tr("Không thể gửi câu trả lời."))); void refresh(); return false; }
  } : undefined} /><AppResults state={state} />{pollOnly && state.status === "active" && <p>{tr("Bạn có thể đổi lựa chọn rồi gửi lại. Mỗi trình duyệt được tính một lượt bình chọn cho ứng dụng này.")}</p>}</>}</div>}</main></RuntimeLocaleProvider>;
}
