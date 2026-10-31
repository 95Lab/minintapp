"use client";
// Participant view of a host-driven quiz: waits for the open question, shows a display-only
// timer, locks the answer, then shows right/wrong once the host reveals it.
import { useEffect, useRef, useState } from "react";
import type { ResponsePayload } from "@/engine/api/api-contract-types";
import type { PublicBlock } from "@/engine/app-spec/strip-private-fields";
import { t, type UiLocale } from "@/engine/i18n/ui-strings-vi-en";

type Quiz = Extract<PublicBlock, { type: "quiz" }>;

export function QuizBlock(props: {
  block: Quiz;
  runtime: { openQuestionId: string | null; revealedQuestionIds: string[] };
  myAnswers: Record<string, ResponsePayload>;
  open: boolean;
  locale: UiLocale;
  onSubmit: (itemId: string, payload: ResponsePayload) => Promise<boolean>;
}) {
  const { block, runtime, myAnswers, open, locale, onSubmit } = props;
  const s = t(locale);
  const q = block.questions.find((x) => x.id === runtime.openQuestionId) ?? null;
  const mineFor = (qid: string) => {
    const a = myAnswers[`${block.id}:${qid}`];
    return a?.kind === "quiz" ? a.optionId : null;
  };
  const mine = q ? mineFor(q.id) : null;
  const revealed = q ? runtime.revealedQuestionIds.includes(q.id) : false;
  const [busy, setBusy] = useState(false);

  // Display-only countdown, started when this device first sees the question.
  const startedAt = useRef<Record<string, number>>({});
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (q && !startedAt.current[q.id]) startedAt.current[q.id] = Date.now();
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [q]);
  const limit = q?.timeLimitSec ?? 0;
  const elapsed = q ? (now - (startedAt.current[q.id] ?? now)) / 1000 : 0;
  const timeLeft = limit > 0 ? Math.max(0, limit - elapsed) : null;
  const timeUp = timeLeft !== null && timeLeft <= 0;

  const score = block.questions.reduce((sum, qq) => (qq.correct && mineFor(qq.id) === qq.correct ? sum + qq.points : sum), 0);

  if (!q) {
    return (
      <section className="card p-card" style={{ textAlign: "center" }}>
        <div className="status-line">{s.waitingQuestion}</div>
        {runtime.revealedQuestionIds.length > 0 && (
          <div className="muted num">{s.yourScore}: {score}</div>
        )}
      </section>
    );
  }

  async function pick(optionId: string) {
    if (!q || mine || revealed || timeUp || !open || busy) return;
    setBusy(true);
    await onSubmit(q.id, { kind: "quiz", optionId });
    setBusy(false);
  }

  const idx = block.questions.indexOf(q);
  return (
    <section className="card p-card">
      <div className="muted" style={{ fontWeight: 600 }}>{s.questionN(idx + 1, block.questions.length)}</div>
      <h2 style={{ fontSize: 21 }}>{q.prompt}</h2>
      {timeLeft !== null && !revealed && !mine && (
        <div className="timer" aria-label={`${Math.ceil(timeLeft)}s`}>
          <div style={{ width: `${(timeLeft / limit) * 100}%` }} />
        </div>
      )}
      <div className="opt-list" role="radiogroup">
        {q.options.map((o) => {
          const cls = revealed ? (o.id === q.correct ? " is-correct" : o.id === mine ? " is-wrong" : "") : "";
          return (
            <button key={o.id} type="button" className={`opt${cls}`} aria-pressed={mine === o.id} onClick={() => pick(o.id)} disabled={!!mine || revealed || timeUp || !open || busy}>
              <span className="mark" aria-hidden="true" />
              {o.label}
            </button>
          );
        })}
      </div>
      {!revealed && mine && <div className="status-line">{s.answerLocked}</div>}
      {revealed && (
        <div className="status-line" style={{ color: mine === q.correct ? "var(--ok)" : "var(--danger)" }}>
          {mine === q.correct ? s.correct : s.wrong}
        </div>
      )}
      <div className="muted num">{s.yourScore}: {score}</div>
    </section>
  );
}
