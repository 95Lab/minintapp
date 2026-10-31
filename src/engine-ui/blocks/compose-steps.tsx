"use client";
// flow "steps": the host opens one input at a time (optionally timed). Participants see only the open
// step with a countdown; the host gets progress, the open question, and next / close / restart.
import { useEffect, useState } from "react";
import type { ComposeResults, ResponsePayload } from "@/engine/api/api-contract-types";
import type { PublicBlock } from "@/engine/app-spec/strip-private-fields";
import { t, type UiLocale } from "@/engine/i18n/ui-strings-vi-en";
import { ComposeRecordForm } from "./compose-record-form";

type Compose = Extract<PublicBlock, { type: "compose" }>;

/**
 * Deadline on THIS device's clock: the server sends the time left, counted from when the state
 * arrived, so a phone whose clock is off still shows the right countdown.
 */
function useLocalDeadline(remainingMs: number | null | undefined, stateKey: unknown): number | null {
  const [local, setLocal] = useState<number | null>(null);
  useEffect(() => {
    setLocal(remainingMs === null || remainingMs === undefined ? null : Date.now() + remainingMs);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-anchor on every fresh state
  }, [remainingMs, stateKey]);
  return local;
}

/** Whole seconds until `deadline` (ms), ticking; null when untimed. */
function useSecondsLeft(deadline: number | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  const expired = deadline !== null && now >= deadline;
  useEffect(() => {
    if (deadline === null || expired) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [deadline, expired]);
  return deadline === null ? null : Math.max(0, Math.ceil((deadline - now) / 1000));
}

function Countdown({ deadline, locale }: { deadline: number | null; locale: UiLocale }) {
  const s = t(locale);
  const left = useSecondsLeft(deadline);
  if (left === null) return null;
  return <div className={`compose-countdown num${left === 0 ? " done" : ""}`}>{left > 0 ? s.composeTimeLeft(left) : s.composeTimeUp}</div>;
}

export function ComposeStepParticipant(props: {
  block: Compose;
  results: ComposeResults | null;
  myAnswers: Record<string, ResponsePayload>;
  open: boolean;
  locale: UiLocale;
  onSubmit: (itemId: string, payload: ResponsePayload) => Promise<boolean>;
}) {
  const { block, results, myAnswers, open, locale, onSubmit } = props;
  const s = t(locale);
  const current = block.inputs.find((i) => i.id === results?.step?.current);
  const deadline = useLocalDeadline(results?.step?.remainingMs, results?.step?.current);
  const left = useSecondsLeft(deadline);
  if (!current) return <div className="muted">{s.composeWaitingStep}</div>;
  // Buzzer presses name the game they belong to (restart starts a new one).
  const itemId = current.kind === "buzz" ? `${current.id}~${results?.step?.epoch ?? 0}` : current.id;
  return (
    <div className="compose-form">
      <div className="compose-step-head">
        <span className="muted num">{s.composeStepProgress(block.inputs.indexOf(current) + 1, block.inputs.length)}</span>
        <Countdown deadline={deadline} locale={locale} />
      </div>
      <ComposeRecordForm
        key={itemId}
        block={block}
        inputs={[current]}
        saved={myAnswers[`${block.id}:${itemId}`]}
        results={results}
        open={open && left !== 0}
        locale={locale}
        onSend={(values) => onSubmit(itemId, { kind: "compose", values })}
      />
    </div>
  );
}

export function ComposeStepHostControls(props: {
  block: Compose;
  results: ComposeResults | null;
  locale: UiLocale;
  busy: boolean;
  canControl: boolean;
  onAction: (action: string, args?: Record<string, string | number | boolean>) => void;
}) {
  const { block, results, locale, busy, canControl, onAction } = props;
  const s = t(locale);
  const step = results?.step;
  const current = block.inputs.find((i) => i.id === step?.current);
  const deadline = useLocalDeadline(step?.remainingMs, step?.current);
  const finished = !current && (step?.done.length ?? 0) >= block.inputs.length;
  const onLastStep = !!current && block.inputs.every((i) => i.id === current.id || step?.done.includes(i.id));
  return (
    <div className="compose-steps-host">
      <div className="compose-step-head">
        <span className="q-steps">
          {block.inputs.map((i, n) => (
            <span key={i.id} className={i.id === step?.current ? "on" : step?.done.includes(i.id) ? "done" : ""}>
              {n + 1}
            </span>
          ))}
        </span>
        <Countdown deadline={deadline} locale={locale} />
      </div>
      {current ? <div className="big-q">{current.label}</div> : finished ? <div className="muted">{s.composeStepsDone}</div> : null}
      {canControl && (
        <div className="toolbar">
          {!finished && !onLastStep && (
            <button className="btn btn-app" disabled={busy} onClick={() => onAction("next")}>
              {step?.current || step?.done.length ? s.composeNextStep : s.composeFirstStep}
            </button>
          )}
          {current && (
            <button className={onLastStep ? "btn btn-app" : "btn"} disabled={busy} onClick={() => onAction("close")}>
              {s.composeCloseStep}
            </button>
          )}
          {(step?.done.length ?? 0) > 0 && (
            <button className="btn btn-ghost" disabled={busy} onClick={() => onAction("restart")}>
              {s.composeRestartSteps}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
