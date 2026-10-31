"use client";
// Board view: everyone's entries (questions, ideas, wishes), most liked first. Phones get a ♥ toggle on
// other people's entries; the host screen only shows counts. Likes are stored as records on the server
// ("l-<entry id>"), so counts can't be faked and a refresh keeps them.
import { useState } from "react";
import type { ComposeViewResult } from "@/engine/api/api-contract-types";
import { t, type UiLocale } from "@/engine/i18n/ui-strings-vi-en";

type BoardView = Extract<ComposeViewResult, { kind: "board" }>;

/**
 * A photo on a board. On the host screen — the projector — a photo waiting for approval is blurred
 * until the host taps "show" (tip: moderate from the host link on a phone), so an offensive upload
 * never reaches the room unchecked.
 */
function BoardPhoto({ src, alt, pending, revealLabel }: { src: string; alt: string; pending: boolean; revealLabel: string }) {
  const [revealed, setRevealed] = useState(false);
  const hidden = pending && !revealed;
  return (
    <span className="board-photo-wrap">
      {/* eslint-disable-next-line @next/next/no-img-element -- signed, per-viewer URL from our API; nothing to optimize */}
      <img className={`board-photo${hidden ? " blurred" : ""}`} src={src} alt={alt} loading="lazy" />
      {hidden && (
        <button type="button" className="btn btn-ghost btn-sm reveal-btn" onClick={() => setRevealed(true)}>
          {revealLabel}
        </button>
      )}
    </span>
  );
}

export function ComposeBoardView({
  view,
  locale,
  big,
  onLike,
  onModerate,
}: {
  view: BoardView;
  locale: UiLocale;
  big: boolean;
  onLike?: (entryId: string, like: boolean) => Promise<boolean>;
  onModerate?: (photoId: string, on: boolean) => void;
}) {
  const s = t(locale);
  // Optimistic toggle per entry until the next results refresh arrives.
  const [pending, setPending] = useState<Record<string, boolean>>({});
  if (view.items.length === 0) return <p className="muted" style={{ margin: 0 }}>{s.composeBoardEmpty}</p>;

  async function toggle(id: string, liked: boolean) {
    if (!onLike) return;
    setPending((p) => ({ ...p, [id]: !liked }));
    const ok = await onLike(id, !liked);
    if (!ok) setPending(({ [id]: _drop, ...rest }) => rest);
  }

  return (
    <ol className={`compose-board${big ? " big" : ""}`}>
      {view.items.map((item) => {
        const liked = pending[item.id] ?? item.liked;
        const likes = item.likes + (pending[item.id] === undefined ? 0 : pending[item.id] === item.liked ? 0 : pending[item.id] ? 1 : -1);
        return (
          <li key={item.id}>
            <div className="compose-board-text">
              {item.photo ? (
                <BoardPhoto src={item.photo} alt={s.composePhotoBy(item.name)} pending={!item.approved && !!onModerate} revealLabel={s.composePhotoReveal} />
              ) : null}
              {item.text && <span>{item.text}</span>}
              {item.name && <span className="muted"> — {item.name}</span>}
              {item.photo && !item.approved && <span className="pending-badge">{s.composePhotoPending}</span>}
              {onModerate && item.photoId && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => onModerate(item.photoId!, !item.approved)}>
                  {item.approved ? s.composePhotoHide : s.composePhotoApprove}
                </button>
              )}
            </div>
            {onLike && !item.mine ? (
              <button type="button" className={`like-btn${liked ? " on" : ""}`} aria-pressed={liked} aria-label={liked ? s.composeUnlike : s.composeLike} onClick={() => void toggle(item.id, liked)}>
                ♥ <span className="num">{likes}</span>
              </button>
            ) : (
              <span className="like-count num" aria-label={s.composeLikes(likes)}>♥ {likes}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
