"use client";
import {useLocale} from "@/lib/i18n/locale-provider";
import Link from "next/link";
import {SubdomainField} from "./subdomain-field";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiClientError, requestJson } from "@/lib/api/api-client";
import { planningContext, planningQuestionsLeft, PlanningReplySchema, PlanningRequestSchema, type PlanningMessage, type PlanningReply } from "@/lib/api/planning-contract";
import type { GenerateRequest, Lifetime } from "@/lib/api/api-contract-types";
import styles from "./planning-chat.module.css";

export function PlanningChat({ open, initialPrompt, locale, onClose, onGenerate, initialLifetime = "1h", onLifetimeChange }: {
  open: boolean;
  initialPrompt: string;
  locale: "vi" | "en";
  onClose: () => void;
  initialLifetime?: Lifetime;
  onLifetimeChange?: (lifetime: Lifetime) => void;
  onGenerate: (request: GenerateRequest) => Promise<void>;
}) {
  const {localize:text}=useLocale();
  const dialog = useRef<HTMLDialogElement>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const summary = useRef<HTMLElement>(null);
  const controller = useRef<AbortController | null>(null);
  const started = useRef(false);
  const inFlight = useRef(false);
  const [messages, setMessages] = useState<PlanningMessage[]>([]);
  const [draft, setDraft] = useState(initialPrompt);
  const [pending, setPending] = useState("");
  const [plan, setPlan] = useState<PlanningReply | null>(null);
  const [brief, setBrief] = useState<string | null>(null);
  const [subdomain,setSubdomain]=useState<string|undefined>();
  const [domainValid,setDomainValid]=useState(true);
  const updateDomain=useCallback((name:string|undefined,valid:boolean)=>{setSubdomain(name);setDomainValid(valid);},[]);
  const [publishDemo,setPublishDemo]=useState("private");
  const [lifetime, setLifetime] = useState<Lifetime>(initialLifetime);
  useEffect(() => { setLifetime(initialLifetime); }, [initialLifetime]);
  const [thinking, setThinking] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [quotaError, setQuotaError] = useState(false);
  const busy = thinking || generating;

  async function send(content: string, useDefaults = false) {
    if (inFlight.current || !content.trim()) return;
    const next: PlanningMessage[] = [...messages, { role: "user", content: content.trim() }];
    // The context below may drop old turns, so the full log decides when the question budget is spent.
    const input = PlanningRequestSchema.safeParse({ messages: planningContext(next), currentBrief: brief, locale, lifetime, useDefaults: useDefaults || planningQuestionsLeft(next) === 0 });
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
    setError(""); setQuotaError(false);
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
      if (!abort.signal.aborted) { setQuotaError(error instanceof ApiClientError && error.code === "owner_app_limit"); setError(error instanceof ApiClientError ? error.message : text("Chưa nhận được phản hồi. Bạn có thể gửi lại.", "Could not get a reply. You can send again.")); }
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
  // On a phone the brief and confirm button sit below the chat, far outside the dialog viewport.
  useEffect(() => { if (plan?.status === "ready" && window.matchMedia("(max-width: 650px)").matches) summary.current?.scrollIntoView({ block: "start" }); }, [plan]);
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
        {plan && !busy && plan.status !== "ready" && <div className={styles.suggestions}>{plan.suggestions.map(suggestion => <button key={suggestion} type="button" onClick={() => { setDraft(suggestion); void send(suggestion); }}>{suggestion}</button>)}</div>}
        <form className={styles.reply} onSubmit={e => { e.preventDefault(); void send(draft); }}>
          <label htmlFor="planning-reply">{text("Trao đổi thêm hoặc chỉnh yêu cầu", "Reply or adjust your request")}</label>
          <textarea id="planning-reply" rows={2} maxLength={1200} value={draft} disabled={busy} onChange={e => setDraft(e.target.value)} placeholder={text("Ví dụ: Cho phép chọn nhiều đáp án, ẩn kết quả đến khi tôi chốt…", "For example: allow multiple choices, hide results until I close voting…")} />
          <button type="submit" disabled={busy || !draft.trim()}>{thinking ? text("Đang trao đổi…", "Thinking…") : text("Gửi tin nhắn", "Send message")}</button>
        </form>
        {plan?.status !== "ready" && <button type="button" className={styles.defaults} disabled={busy || plan?.status === "unsupported"} onClick={() => void send(
          [draft.trim(), text("Dùng mặc định hợp lý cho các tùy chọn còn lại và chốt bản yêu cầu. Không hỏi thêm tùy chọn phụ.", "Use sensible defaults for remaining options and finalize the brief. Do not ask about optional details.")].filter(Boolean).join("\n"), true
        )}>{text("Dùng mặc định và chốt yêu cầu", "Use defaults and finalize brief")}</button>}
      </section>
      <aside ref={summary} className={styles.summary} aria-label={text("Bản yêu cầu", "App brief")}>
        <p className={styles.eyebrow}>{text("APP CỦA BẠN", "YOUR APP")}</p>
        <h3>{plan?.status === "ready" ? text("Sẵn sàng để bạn chốt", "Ready for your review") : text("Đang làm rõ ý tưởng", "Shaping the idea")}</h3>
        {brief ? <p className={styles.brief}>{brief}</p> : <p className={styles.hint}>{text("Bản yêu cầu sẽ được cập nhật tại đây sau khi trao đổi.", "Your app brief will appear here as we work out the details.")}</p>}
        <label className={styles.lifetime}>{text("Thời gian sử dụng", "App lifetime")}<select value={lifetime} onChange={e => { const value = e.target.value as Lifetime; setLifetime(value); onLifetimeChange?.(value); }} disabled={busy}><option value="1h">{text("1 giờ", "1 hour")}</option><option value="24h">{text("24 giờ", "24 hours")}</option><option value="7d">{text("7 ngày", "7 days")}</option></select></label>
        {draft.trim() && plan?.status === "ready" && <p className={styles.hint}>{text("Gửi nội dung đang nhập để cập nhật bản yêu cầu trước khi chốt.", "Send your pending message to update the brief before confirming.")}</p>}
        <SubdomainField onChange={updateDomain} disabled={busy}/>
        <div className={styles.publication}><label>{text("Đưa app lên Khám phá tất cả mẫu?", "List your app in Explore all templates?")}<select value={publishDemo} onChange={e=>setPublishDemo(e.target.value)} disabled={busy}><option value="private">{text("Không, giữ riêng tư", "No, keep private")}</option><option value="free">{text("Công khai dạng Free (miễn phí)", "List as Free")}</option><option value="paid">{text("Công khai dạng Paid (có phí)", "List as Paid")}</option></select></label><p>{text("Giả lập demo: lựa chọn này chưa công khai app, chưa lưu lên marketplace và chưa thu phí. Khi phát hành thật, chỉ chia sẻ mẫu, không chia sẻ câu trả lời hoặc dữ liệu riêng.", "Demo only: this choice does not publish your app, save a marketplace listing or charge anyone. A real listing would share the template, not responses or private data.")}</p></div>
        <button type="button" className={styles.confirm} disabled={busy || !domainValid || plan?.status !== "ready" || !brief || !!draft.trim()} onClick={async () => {
          if (inFlight.current || !brief || plan?.status !== "ready" || draft.trim()) return;
          inFlight.current = true;
          setGenerating(true); setError(""); setQuotaError(false);
          try { await onGenerate({ prompt: brief, lifetime,...(subdomain?{subdomain}:{}) }); }
          catch (error) { setQuotaError(error instanceof ApiClientError && error.code === "owner_app_limit"); setError(error instanceof ApiClientError ? error.message : text("Không thể tạo ứng dụng. Vui lòng thử lại.", "Could not create the app. Please try again.")); }
          finally { setGenerating(false); inFlight.current = false; }
        }}>{generating ? text("Đang tạo ứng dụng…", "Creating app…") : text("Chốt yêu cầu và tạo app", "Confirm brief and create app")}</button>
        <p className={styles.hint}>{text("Bản yêu cầu và thời gian đã chọn được gửi sang bước tạo app. Thời hạn luôn theo ô Thời gian sử dụng.", "The brief and selected lifetime are sent to generation. The lifetime selector determines expiry.")}</p>
      </aside>
    </div>
    {error && <p className={styles.error} role="alert">{error}{quotaError && <> <Link href="/dashboard">{text("Mở Ứng dụng của tôi", "Open My apps")}</Link></>}</p>}
  </dialog>;
}
