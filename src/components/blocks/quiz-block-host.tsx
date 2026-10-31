"use client";
import { useRuntimeTranslation } from "@/lib/i18n/runtime-locale";
import { useState } from "react";
import type { HostBlockProps, PublicBlockOf } from "./block-ui-types";
export function QuizBlockHost({ block, busy, canControl, onAction }: HostBlockProps<PublicBlockOf<"quiz">>) {
  const tr = useRuntimeTranslation();
  const [pending, setPending] = useState(false); const [error, setError] = useState("");
  async function run(action: string, questionId: string) { if (!onAction || pending) return; setPending(true); setError(""); try { await onAction(action, { questionId }); } catch { setError(tr("Không thể điều khiển câu hỏi.")); } finally { setPending(false); } }
  return <section className="mini-card"><h2>{tr("Điều khiển quiz")}</h2>{block.questions.map((q) => <div key={q.id} data-testid={`question-${q.id}`}><h3>{q.prompt}</h3><div className="mini-actions"><button disabled={!canControl || busy || pending || !onAction} onClick={() => run("open", q.id)}>{tr("Mở câu hỏi")}</button><button disabled={!canControl || busy || pending || !onAction} onClick={() => run("reveal", q.id)}>{tr("Hiện đáp án")}</button></div></div>)}{error && <p role="alert">{error}</p>}</section>;
}
