"use client";
import { useRuntimeTranslation } from "@/lib/i18n/runtime-locale";
import { useState } from "react";
import type { ParticipantBlockProps, PublicBlockOf } from "./block-ui-types";
export function QuizBlock({ block, runtime, open, onSubmit, myAnswers }: ParticipantBlockProps<PublicBlockOf<"quiz">>) {
  const tr = useRuntimeTranslation();
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const question = block.questions.find((q) => q.id === runtime.openQuestionId);
  if (!question) return <section className="mini-card"><h2>Quiz</h2><p>{tr("Chờ host mở câu hỏi.")}</p></section>;
  const revealed = runtime.revealedQuestionIds.includes(question.id);
  const saved = myAnswers?.[`${block.id}:${question.id}`];
  return <section className="mini-card"><h2>{question.prompt}</h2><p>{tr("{points} điểm · Thời lượng gợi ý: {seconds} giây. Host công bố đáp án để kết thúc câu hỏi.", { points: question.points, seconds: question.timeLimitSec })}</p><div className="mini-stack">{question.options.map((o) => <button type="button" key={o.id} disabled={!open || revealed || busy || !onSubmit} aria-pressed={saved?.kind === "quiz" && saved.optionId === o.id} onClick={async () => {
    if (!onSubmit || busy) return; setBusy(true); setMessage("");
    try { setMessage(await onSubmit(question.id, { kind: "quiz", optionId: o.id }) ? tr("Đã gửi đáp án.") : tr("Không thể gửi đáp án.")); }
    catch { setMessage(tr("Không thể gửi đáp án.")); } finally { setBusy(false); }
  }}>{o.label}{revealed && question.correct === o.id ? " ✓" : ""}</button>)}</div><p role="status">{message}</p></section>;
}
