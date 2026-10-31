"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getParticipantToken } from "@/lib/participant/participant-token";
import { useAppState } from "@/lib/realtime/use-app-state";
import { ApiClientError, sendVote, changeLifecycle } from "@/lib/api/api-client";
import { BrandTopBar } from "./brand-top-bar";
import { AppRendererParticipant } from "./app-renderer-participant";
import { AppRendererHost } from "./app-renderer-host";
import { PollResults } from "./blocks/poll-results";
import { SharePanelQr } from "./share/share-panel-qr";
import { ExpiryCountdown } from "./lifecycle/expiry-countdown";
import { ExpiredNotice } from "./lifecycle/expired-notice";
export function PollRoom({ id, host = false }: { id: string; host?: boolean }) {
  const [token, setToken] = useState<string | null>(null);
  const [storageError, setStorageError] = useState("");
  const [origin, setOrigin] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const { state, error, failureStatus, refresh } = useAppState(id, host, token);
  useEffect(() => {
    setOrigin(window.location.origin);
    if (!host) {
      try { setToken(getParticipantToken(id)); }
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
  if (failureStatus === 404 || failureStatus === 410) return <main className="component-preview"><ExpiredNotice reason={failureStatus === 404 ? "not_found" : "unavailable"} /></main>;
  if (failureStatus === 403) return <main className="component-preview"><h1>Không có quyền host</h1><p>Hãy mở bằng trình duyệt đã tạo ứng dụng. Liên kết host không tự cấp quyền điều khiển.</p><Link href={`/a/${id}`}>Tham gia bình chọn</Link></main>;
  return <main className="component-preview"><BrandTopBar /><p className="mini-notice">Chế độ memory: dữ liệu tạm thời, mất khi server khởi động lại.</p>{storageError && <p role="alert">{storageError}</p>}{error && <p role="alert">{error}</p>}{actionError && <p role="alert">{actionError}</p>}{!state && !storageError && <p role="status">Đang tải ứng dụng…</p>}{state && <div className="mini-app"><ExpiryCountdown expiresAt={state.expiresAt} />{host ? <><AppRendererHost spec={state.spec} runtime={state.runtime} canControl={false} results={<PollResults state={state} />} /><div className="mini-actions"><button disabled={busy || !!error} onClick={() => transition(state.status === "active" ? "close" : "reopen")}>{state.status === "active" ? "Đóng bình chọn" : "Mở lại bình chọn"}</button><button disabled={busy || !!error} onClick={() => transition("end")}>Kết thúc và xoá dữ liệu</button></div><p role="status">{state.status === "active" ? "Đang nhận bình chọn" : "Đã đóng bình chọn"}</p>{origin && <SharePanelQr url={`${origin}/a/${id}`} />}<Link href={`/a/${id}`}>Mở trang participant</Link></> : <><AppRendererParticipant spec={state.spec} runtime={state.runtime} open={state.status === "active" && !error} myAnswers={state.myAnswers} onSubmit={token ? async (blockId, itemId, payload) => {
    setActionError("");
    try { await sendVote(id, { blockId, itemId, participantToken: token, displayName: null, payload }); await refresh(); return true; }
    catch (error) { setActionError(error instanceof ApiClientError ? error.message : "Không thể gửi bình chọn."); void refresh(); return false; }
  } : undefined} /><PollResults state={state} /><p>Bạn có thể đổi lựa chọn rồi gửi lại. Mỗi trình duyệt được tính một lượt bình chọn cho ứng dụng này.</p></>}</div>}</main>;
}
