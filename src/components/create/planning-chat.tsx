"use client";
import { useEffect, useRef, useState } from "react";
import { ApiClientError, requestJson } from "@/lib/api/api-client";
import { planningContext, PlanningReplySchema, PlanningRequestSchema, type PlanningMessage, type PlanningReply } from "@/lib/api/planning-contract";
import type { GenerateRequest, Lifetime } from "@/lib/api/api-contract-types";
import styles from "./planning-chat.module.css";

export function PlanningChat({ open, initialPrompt, locale, onClose, onGenerate }: {
  open: boolean;
  initialPrompt: string;
  locale: "vi" | "en";
  onClose: () => void;
  onGenerate: (request: GenerateRequest) => Promise<void>;
}) {
  const text = (vi: string, en: string) => locale === "vi" ? vi : en;
  const dialog = useRef<HTMLDialogElement>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const controller = useRef<AbortController | null>(null);
  const started = useRef(false);
  const inFlight = useRef(false);
  const [messages, setMessages] = useState<PlanningMessage[]>([]);
  const [draft, setDraft] = useState(initialPrompt);
  const [pending, setPending] = useState("");
  const [plan, setPlan] = useState<PlanningReply | null>(null);
  const [brief, setBrief] = useState<string | null>(null);
  const [lifetime, setLifetime] = useState<Lifetime>("1h");
  const [thinking, setThinking] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const busy = thinking || generating;

  async function send(content: string) {
    if (inFlight.current || !content.trim()) return;
    const next: PlanningMessage[] = [...messages, { role: "user", content: content.trim() }];
    const input = PlanningRequestSchema.safeParse({ messages: planningContext(next), currentBrief: brief, locale });
    if (!input.success) {
      setPlan(null);
      setError(text("Tin nhắn chưa hợp lệ. Hãy nhập từ 1 đến 1.200 ký tự rồi gửi lại.", "Invalid message. Enter 1–1,200 characters and try again."));
      return;
    }
    inFlight.current = true;
    const abort = new AbortController();
    controller.current = abort;
    setThinking(true);
    setPending(content.trim());
    setPlan(null);
    setError("");
    try {
      const result = PlanningReplySchema.parse(await requestJson<unknown>("/api/engine/plan", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input.data), signal: abort.signal,
      }, 30_000));
      if (abort.signal.aborted) return;
      setMessages([...next, { role: "assistant", content: result.message }]);
      setPlan(result);
      setBrief(result.brief);
      setDraft("");
    } catch (error) {
      if (!abort.signal.aborted) setError(error instanceof ApiClientError ? error.message : text("Chưa nhận được phản hồi. Bạn có thể gửi lại.", "Could not get a reply. You can send again."));
    } finally {
      if (controller.current === abort) {
        setThinking(false);
        setPending("");
        inFlight.current = false;
      }
    }
  }

  useEffect(() => {
    let cancelled = false;
    if (open) {
      if (!dialog.current?.open) dialog.current?.showModal();
      queueMicrotask(() => { if (!cancelled && !started.current) { started.current = true; void send(initialPrompt); } });
    } else {
      dialog.current?.close();
      controller.current?.abort();
    }
    return () => { cancelled = true; controller.current?.abort(); };
    // Opening resumes the same chat; only the initial idea starts a new conversation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => { transcript.current?.scrollTo({ top: transcript.current.scrollHeight, behavior: "smooth" }); }, [messages, pending, thinking]);

  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="planning-title" aria-describedby="planning-description" onCancel={e => { e.preventDefault(); if (!generating) onClose(); }}>
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>MININTAPP · OPENAI</p><h2 id="planning-title">{text("Cùng chốt ý tưởng", "Let's shape your app")}</h2></div>
      <button type="button" className={styles.close} disabled={generating} aria-label={text("Đóng cửa sổ chat", "Close chat")} onClick={onClose}>×</button>
    </header>
    <p id="planning-description" className={styles.description}>{text("Trao đổi để làm rõ. Bạn chốt, app mới được tạo.", "Work out the details together. Creation starts when you confirm.")}</p>
    <div className={styles.body}>
      <section className={styles.conversation} aria-label={text("Cuộc trò chuyện", "Conversation")}>
        <div ref={transcript} className={styles.transcript} role="log" aria-live="polite" aria-relevant="additions text">
          {messages.map((message, index) => <article key={index} className={message.role === "user" ? styles.user : styles.assistant}>
            <span className={styles.speaker}>{message.role === "user" ? text("Bạn", "You") : "MinintApp"}</span><p>{message.content}</p>
          </article>)}
          {pending && <article className={styles.user}><span className={styles.speaker}>{text("Bạn", "You")}</span><p>{pending}</p></article>}
          {thinking && <p role="status" className={styles.thinking}>{text("Đang suy nghĩ về ý tưởng của bạn…", "Thinking about your idea…")}</p>}
        </div>
        {plan && !busy && <div className={styles.suggestions}>{plan.suggestions.map(suggestion => <button key={suggestion} type="button" onClick={() => { setDraft(suggestion); void send(suggestion); }}>{suggestion}</button>)}</div>}
        <form className={styles.reply} onSubmit={e => { e.preventDefault(); void send(draft); }}>
          <label htmlFor="planning-reply">{text("Trao đổi thêm hoặc chỉnh yêu cầu", "Reply or adjust your request")}</label>
          <textarea id="planning-reply" rows={2} maxLength={1200} value={draft} disabled={busy} onChange={e => setDraft(e.target.value)} placeholder={text("Ví dụ: Cho phép chọn nhiều đáp án, ẩn kết quả đến khi tôi chốt…", "For example: allow multiple choices, hide results until I close voting…")} />
          <button type="submit" disabled={busy || !draft.trim()}>{thinking ? text("Đang trao đổi…", "Thinking…") : text("Gửi tin nhắn", "Send message")}</button>
        </form>
      </section>
      <aside className={styles.summary} aria-label={text("Bản yêu cầu", "App brief")}>
        <p className={styles.eyebrow}>{text("APP CỦA BẠN", "YOUR APP")}</p>
        <h3>{plan?.status === "ready" ? text("Sẵn sàng để bạn chốt", "Ready for your review") : text("Đang làm rõ ý tưởng", "Shaping the idea")}</h3>
        {brief ? <p className={styles.brief}>{brief}</p> : <p className={styles.hint}>{text("Bản yêu cầu sẽ được cập nhật tại đây sau khi trao đổi.", "Your app brief will appear here as we work out the details.")}</p>}
        <label className={styles.lifetime}>{text("Thời gian sử dụng", "App lifetime")}<select value={lifetime} onChange={e => setLifetime(e.target.value as Lifetime)} disabled={busy}><option value="1h">{text("1 giờ", "1 hour")}</option><option value="24h">{text("24 giờ", "24 hours")}</option><option value="7d">{text("7 ngày", "7 days")}</option></select></label>
        {draft.trim() && plan?.status === "ready" && <p className={styles.hint}>{text("Gửi nội dung đang nhập để cập nhật bản yêu cầu trước khi chốt.", "Send your pending message to update the brief before confirming.")}</p>}
        <button type="button" className={styles.confirm} disabled={busy || plan?.status !== "ready" || !brief || !!draft.trim()} onClick={async () => {
          if (inFlight.current || !brief || plan?.status !== "ready" || draft.trim()) return;
          inFlight.current = true;
          setGenerating(true); setError("");
          try { await onGenerate({ prompt: brief, lifetime }); }
          catch (error) { setError(error instanceof ApiClientError ? error.message : text("Không thể tạo ứng dụng. Vui lòng thử lại.", "Could not create the app. Please try again.")); }
          finally { setGenerating(false); inFlight.current = false; }
        }}>{generating ? text("Đang tạo ứng dụng…", "Creating app…") : text("Chốt yêu cầu và tạo app", "Confirm brief and create app")}</button>
        <p className={styles.hint}>{text("Chỉ bản yêu cầu đã chốt được gửi sang bước tạo app.", "Only the confirmed brief is sent to app generation.")}</p>
      </aside>
    </div>
    {error && <p className={styles.error} role="alert">{error}</p>}
  </dialog>;
}
