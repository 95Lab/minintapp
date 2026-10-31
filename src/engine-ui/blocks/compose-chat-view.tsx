"use client";
// Chat view: the messages of a text input, oldest first, newest at the bottom. Own messages sit on the
// right. The feed follows new messages unless the reader scrolled up, in which case a "new messages"
// button brings them back down.
import { useEffect, useRef, useState } from "react";
import type { ComposeViewResult } from "@/engine/api/api-contract-types";
import { t, type UiLocale } from "@/engine/i18n/ui-strings-vi-en";

type ChatView = Extract<ComposeViewResult, { kind: "chat" }>;

/** Within this many px of the bottom counts as "at the bottom". */
const BOTTOM_SLACK_PX = 48;

/** A message id is "<roster id>-<record id>"; the record id is what a delete names. */
const recordIdOf = (messageId: string) => messageId.slice(messageId.indexOf("-") + 1);

export function ComposeChatView({ view, locale, big, onRemove }: { view: ChatView; locale: UiLocale; big: boolean; onRemove?: (itemId: string) => void }) {
  const s = t(locale);
  const feed = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const [behind, setBehind] = useState(false);
  const newest = view.messages.at(-1)?.id ?? "";
  const clock = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { hour: "2-digit", minute: "2-digit" });

  // New message: stay glued to the bottom, or flag it when the reader is looking at older ones.
  useEffect(() => {
    const el = feed.current;
    if (!el) return;
    if (following.current) el.scrollTop = el.scrollHeight;
    else setBehind(true);
  }, [newest]);

  function onScroll() {
    const el = feed.current;
    if (!el) return;
    following.current = el.scrollHeight - el.scrollTop - el.clientHeight <= BOTTOM_SLACK_PX;
    if (following.current) setBehind(false);
  }

  function jumpToNewest() {
    const el = feed.current;
    if (el) el.scrollTop = el.scrollHeight;
    following.current = true;
    setBehind(false);
  }

  if (view.messages.length === 0) return <p className="muted" style={{ margin: 0 }}>{s.composeChatEmpty}</p>;

  return (
    <div className="compose-chat-wrap">
      <div className={`compose-chat${big ? " big" : ""}`} ref={feed} onScroll={onScroll} role="log" aria-live="polite">
        {view.messages.map((m) => (
          <div key={m.id} className={`chat-msg${m.mine ? " mine" : ""}`}>
            <div className="chat-meta">
              <b>{m.author}</b> <time className="num" dateTime={new Date(m.at).toISOString()}>{clock.format(m.at)}</time>
            </div>
            <div className="chat-bubble">{m.text}</div>
            {m.mine && onRemove && (
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => onRemove(recordIdOf(m.id))}>
                {s.composeChatDelete}
              </button>
            )}
          </div>
        ))}
      </div>
      {behind && (
        <button type="button" className="btn btn-sm chat-newer" onClick={jumpToNewest}>
          {s.composeChatNewer}
        </button>
      )}
    </div>
  );
}
