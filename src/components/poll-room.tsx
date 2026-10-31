"use client";
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
  const [displayName, setDisplayName] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [storageError, setStorageError] = useState("");
  const [origin, setOrigin] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const { state, error, failureStatus, refresh } = useAppState(id, host, token);
  useEffect(() => {
    setOrigin(window.location.origin);
    if (!host) {
      try { setToken(getParticipantToken(id)); setDisplayName(localStorage.getItem(`minint_name_${id}`) ?? ""); }
      catch { setStorageError("Cần cho phép lưu trữ của trình duyệt để giữ danh tính và đổi vote."); }
    }
  }, [id, host]);
  async function transition(action: "close" | "reopen" | "end") {
    if (busy || !state?.isHost) return;
    if (action === "end" && !window.confirm("Kết thúc và xoá toàn bộ câu trả lời? Thao tác này không thể hoàn tác.")) return;
    setBusy(true); setActionError("");
    try { await changeLifecycle(id, action); await refresh(); }
    catch (error) { setActionError(error instanceof ApiClientError ? error.message : "Không thể thay đổi trạng thái ứng dụng."); }
    finally { setBusy(false); }
  }
  const pollOnly = state?.spec.blocks.every((block) => block.type === "compose" && block.inputs.length === 1 && block.inputs[0].kind === "choice" && block.entries === "one" && block.flow === "open");
  if (failureStatus === 404 || failureStatus === 410) return <main className="component-preview"><ExpiredNotice reason={failureStatus === 404 ? "not_found" : "unavailable"} /></main>;
  if (failureStatus === 403) return <main className="component-preview"><h1>Không có quyền host</h1><p>Hãy mở bằng trình duyệt đã tạo ứng dụng. Liên kết host không tự cấp quyền điều khiển.</p><Link href={`/a/${id}`}>Tham gia ứng dụng</Link></main>;
  return <main className="component-preview"><BrandTopBar /><p className="mini-notice">{state?.sync?.mode === "supabase" ? "Dữ liệu được lưu trên Supabase · đồng bộ Realtime." : state ? "Chế độ memory: dữ liệu tạm thời, mất khi server khởi động lại." : "Đang kết nối ứng dụng…"}</p>{storageError && <p role="alert">{storageError}</p>}{error && <p role="alert">{error}</p>}{actionError && <p role="alert">{actionError}</p>}{!state && !storageError && <p role="status">Đang tải ứng dụng…</p>}{state && <div className="mini-app"><ExpiryCountdown expiresAt={state.expiresAt} />{host ? <><AppRendererHost spec={state.spec} runtime={state.runtime} blockResults={state.results} canControl={state.isHost && state.status === "active" && !error && !busy} busy={busy} onAction={async (blockId, action, args) => {
    setBusy(true); setActionError("");
    try { await sendBlockAction(id, blockId, action, args); await refresh(); }
    catch (error) { setActionError(error instanceof ApiClientError ? error.message : "Không thể điều khiển ứng dụng."); throw error; }
    finally { setBusy(false); }
  }} results={<AppResults state={state} />} /><div className="mini-actions"><button disabled={busy || !!error} onClick={() => transition(state.status === "active" ? "close" : "reopen")}>{state.status === "active" ? (pollOnly ? "Đóng bình chọn" : "Đóng ứng dụng") : (pollOnly ? "Mở lại bình chọn" : "Mở lại ứng dụng")}</button><button disabled={busy || !!error} onClick={() => transition("end")}>Kết thúc và xoá dữ liệu</button></div><p role="status">{state.status === "active" ? "Đang nhận câu trả lời" : "Đã đóng nhận câu trả lời"}</p>{origin && <SharePanelQr url={`${origin}/a/${id}`} />}<a href={`/api/apps/${id}/upgrade`}>Mở đầy đủ công cụ quản lý, export và remix</a><Link href={`/a/${id}`}>Mở trang participant</Link></> : <>{state.spec.requireName && !displayName && <form className="mini-card" onSubmit={(event) => {
    event.preventDefault(); const name = nameDraft.trim(); if (!name) return;
    try { localStorage.setItem(`minint_name_${id}`, name); setDisplayName(name); }
    catch { setStorageError("Không thể lưu tên trong trình duyệt."); }
  }}><label className="mini-field">Tên hiển thị<input required maxLength={40} value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} /></label><button>Tham gia ứng dụng</button></form>}<AppRendererParticipant spec={state.spec} runtime={state.runtime} displayName={displayName} blockResults={state.results} open={state.status === "active" && !error} myAnswers={state.myAnswers} onSubmit={token ? async (blockId, itemId, payload) => {
    setActionError("");
    try { await sendVote(id, { blockId, itemId, participantToken: token, displayName: displayName || null, payload }); await refresh(); return true; }
    catch (error) { setActionError(error instanceof ApiClientError ? error.message : "Không thể gửi câu trả lời."); void refresh(); return false; }
  } : undefined} /><AppResults state={state} />{pollOnly && <p>Bạn có thể đổi lựa chọn rồi gửi lại. Mỗi trình duyệt được tính một lượt bình chọn cho ứng dụng này.</p>}</>}</div>}</main>;
}
