"use client";
// Host view of a quiz: question stepper, open → reveal → next controls, answer bars
// (correct option highlighted after reveal) and the leaderboard.
import type { QuizResults } from "@/engine/api/api-contract-types";
import type { PublicBlock } from "@/engine/app-spec/strip-private-fields";
import { t, type UiLocale } from "@/engine/i18n/ui-strings-vi-en";
import { BarChartLive } from "./bar-chart-live";

type Quiz = Extract<PublicBlock, { type: "quiz" }>;

export function QuizBlockHost(props: {
  block: Quiz;
  results: QuizResults | null;
  runtime: { openQuestionId: string | null; revealedQuestionIds: string[] };
  locale: UiLocale;
  busy: boolean;
  canControl: boolean;
  onAction: (action: "open" | "reveal", questionId: string) => void;
}) {
  const { block, results, runtime, locale, busy, canControl, onAction } = props;
  const s = t(locale);
  const qs = block.questions;
  const idx = qs.findIndex((q) => q.id === runtime.openQuestionId);
  const current = idx >= 0 ? qs[idx] : null;
  const revealed = current ? runtime.revealedQuestionIds.includes(current.id) : false;
  const next = idx + 1 < qs.length ? qs[idx + 1] : null;
  const counts = current ? (results?.countsByQuestion[current.id] ?? {}) : {};
  const answered = current ? (results?.answeredByQuestion[current.id] ?? 0) : 0;

  return (
    <div style={{ display: "grid", gap: 22 }}>
      <div className="q-steps" aria-label="Tiến độ">
        {qs.map((q, i) => (
          <span key={q.id} className={q.id === runtime.openQuestionId ? "on" : runtime.revealedQuestionIds.includes(q.id) ? "done" : ""}>
            {i + 1}
          </span>
        ))}
      </div>

      {current ? (
        <div>
          <div className="muted" style={{ fontWeight: 600, marginBottom: 6 }}>
            {s.questionN(idx + 1, qs.length)} · <span className="num">{s.answered(answered)}</span>
          </div>
          <div className="big-q">{current.prompt}</div>
          {revealed ? (
            <BarChartLive
              total={answered}
              highlightWinner={false}
              data={current.options.map((o) => ({ id: o.id, label: o.label, value: counts[o.id] ?? 0, correct: o.id === current.correct }))}
            />
          ) : (
            // The projector is public: per-option counts before the reveal would give the answer away.
            <ol className="opt-list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {current.options.map((o, i) => (
                <li key={o.id} className="opt" style={{ cursor: "default", fontSize: "clamp(17px, 1.8vw, 24px)" }}>
                  <span className="rank num" style={{ color: "var(--app)", fontWeight: 800 }}>{String.fromCharCode(65 + i)}</span>
                  {o.label}
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : (
        <p className="big-q muted" style={{ fontWeight: 500 }}>{s.waitingStart}</p>
      )}

      {canControl && (
        <div className="toolbar">
          {!current && (
            <button className="btn btn-app btn-lg" disabled={busy} onClick={() => onAction("open", qs[0].id)}>
              {s.openQuestion} 1
            </button>
          )}
          {current && !revealed && (
            <button className="btn btn-app btn-lg" disabled={busy} onClick={() => onAction("reveal", current.id)}>
              {s.reveal}
            </button>
          )}
          {current && revealed && next && (
            <button className="btn btn-app btn-lg" disabled={busy} onClick={() => onAction("open", next.id)}>
              {s.nextQuestion}
            </button>
          )}
        </div>
      )}

      {block.leaderboard && (
        <div>
          <div className="panel-title">{s.leaderboard}</div>
          {results?.leaderboard.length ? (
            <ol className="lb">
              {results.leaderboard.map((row, i) => (
                <li key={`${row.name}-${i}`}>
                  <span className="rank num">{i + 1}</span>
                  <span>{row.name}</span>
                  <span className="num">{row.score}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted" style={{ margin: 0 }}>—</p>
          )}
        </div>
      )}
    </div>
  );
}
