"use client";
// compose brick UI — also renders the presets (poll, group order, word cloud), which are compose at
// runtime. Participant: one record form, a list of own entries (entries "many"), or only the open
// step (flow "steps"); blocks with a people picker / teams check the participant in automatically.
// Host: step controls, team draw, and every view at projector size.
import { useEffect, useRef, useState } from "react";
import type { ComposeResults } from "@/engine/api/api-contract-types";
import type { PublicBlock } from "@/engine/app-spec/strip-private-fields";
import { PAID_ITEM_ID } from "@/engine/blocks/compose/compose-atoms-schema";
import { needsRoster } from "@/engine/blocks/compose/compose-wiring-rules";
import { t } from "@/engine/i18n/ui-strings-vi-en";
import type { HostBlockProps, ParticipantBlockProps } from "./block-ui-types";
import { ComposeEntriesList } from "./compose-entries-list";
import { ComposeRecordForm } from "./compose-record-form";
import { ComposeStepHostControls, ComposeStepParticipant } from "./compose-steps";
import { PhotoUploadContext } from "./compose-photo-upload";
import type { SettleActions } from "./compose-settle-view";
import { ComposeViewCard } from "./compose-view-renderer";

type Compose = Extract<PublicBlock, { type: "compose" }>;

export function ComposeBlockHost({ block, results, locale, busy, canControl, canSettle = false, onAction, payee = null, appTitle = "" }: HostBlockProps<Compose, ComposeResults>) {
  const s = t(locale);
  const teamsView = block.views.find((v) => v.kind === "teams");
  const drawn = results?.views.some((v) => v.kind === "teams" && v.teams);
  // Settle view: the host confirms what a person has paid (also after the log is closed); the host screen has no QR of its own to pay.
  const settle: SettleActions = { payee, appTitle, onConfirmReceived: canSettle ? (rosterId, amount) => onAction("confirm_paid", { rosterId, amount }) : undefined };
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div>
        <div className="big-q" style={{ marginBottom: 4 }}>{block.title}</div>
        {block.note && <p className="muted" style={{ margin: 0 }}>{block.note}</p>}
      </div>
      {block.flow === "steps" && <ComposeStepHostControls block={block} results={results} locale={locale} busy={busy} canControl={canControl} onAction={onAction} />}
      {teamsView && canControl && (
        <div className="toolbar">
          <button className="btn btn-app" disabled={busy || (results?.roster?.length ?? 0) < 2} onClick={() => onAction("shuffle", { viewId: teamsView.id })}>
            {drawn ? s.composeReshuffle : s.composeShuffle}
          </button>
          <span className="muted num">{s.composeJoinedCount(results?.roster?.length ?? 0)}</span>
        </div>
      )}
      <div className="compose-views">
        {(results?.views ?? []).map((v) => (
          <ComposeViewCard key={v.id} view={v} locale={locale} big blockTitle={block.title} onModerate={canControl ? (photoId, on) => onAction("approve", { photoId, on }) : undefined} settle={settle} />
        ))}
      </div>
      {block.inputs.length > 0 && <div className="muted num">{s.composeSubmissions(results?.submissions ?? 0)}</div>}
    </div>
  );
}

export function ComposeBlock({ block, results, myAnswers, open, locale, onSubmit, onUpload, payee = null, appTitle = "" }: ParticipantBlockProps<Compose, ComposeResults>) {
  const s = t(locale);
  const waitlisted = (results?.myWaitlist.length ?? 0) > 0;

  // People picker / teams: put this participant on the roster as soon as they open the app.
  // A failed check-in (bad wifi, rate limit) is retried a few seconds later.
  const joinSent = useRef(false);
  const [joinRetry, setJoinRetry] = useState(0);
  const mustJoin = needsRoster(block) && open && results !== null && !results.joined;
  useEffect(() => {
    if (!mustJoin || joinSent.current) return;
    joinSent.current = true;
    void onSubmit("_join", { kind: "compose", values: {}, join: true }).then((ok) => {
      if (ok) return;
      setTimeout(() => {
        joinSent.current = false;
        setJoinRetry((n) => n + 1);
      }, 4000);
    });
  }, [mustJoin, onSubmit, joinRetry]);

  // Board likes are records of their own: "l-<entry id>"; unliking deletes it.
  const like = (entryId: string, on: boolean) => onSubmit(`l-${entryId}`, on ? { kind: "compose", values: {}, like: true } : { kind: "compose", values: {}, removed: true });

  // Settle view: "I've transferred" is one mark per person (record "_paid") carrying the amount owed at that moment; null withdraws it.
  // It works on a closed log too: people settle up after the host stops taking expenses.
  const markPaid = (amount: number | null) => void onSubmit(PAID_ITEM_ID, amount !== null ? { kind: "compose", values: {}, paid: amount } : { kind: "compose", values: {}, removed: true });
  // Chat: a person can delete their own message (frees a slot, removes a mistake).
  const removeMessage = (itemId: string) => void onSubmit(itemId, { kind: "compose", values: {}, removed: true });
  const settle: SettleActions = { payee, appTitle, onMarkPaid: markPaid };

  const views = results?.views ?? [];
  const renderView = (v: (typeof views)[number]) => <ComposeViewCard key={v.id} view={v} locale={locale} blockTitle={block.title} onLike={open ? like : undefined} onRemoveMessage={open ? removeMessage : undefined} settle={settle} />;

  let body;
  if (block.flow === "steps") {
    body = <ComposeStepParticipant block={block} results={results} myAnswers={myAnswers} open={open} locale={locale} onSubmit={onSubmit} />;
  } else if (block.entries === "many") {
    body = <ComposeEntriesList block={block} results={results} myAnswers={myAnswers} open={open} locale={locale} onSubmit={onSubmit} />;
  } else if (block.inputs.length > 0) {
    body = (
      <ComposeRecordForm
        block={block}
        inputs={block.inputs}
        saved={myAnswers[`${block.id}:`]}
        results={results}
        open={open}
        locale={locale}
        onSend={(values) => onSubmit("", { kind: "compose", values })}
      />
    );
  } else {
    body = results?.joined ? <div className="status-line">{s.composeJoined}</div> : null;
  }

  return (
    <section className="card p-card">
      <h2 style={{ fontSize: 21 }}>{block.title}</h2>
      {block.note && <p className="muted" style={{ margin: 0 }}>{block.note}</p>}
      {/* a chat feed sits above the form, which then works as its composer */}
      {views.filter((v) => v.kind === "chat").map(renderView)}
      <PhotoUploadContext.Provider value={onUpload ?? null}>{body}</PhotoUploadContext.Provider>
      {waitlisted && <div className="notice warn">{s.composeWaitlisted}</div>}
      {views.filter((v) => v.kind !== "chat").map(renderView)}
    </section>
  );
}
