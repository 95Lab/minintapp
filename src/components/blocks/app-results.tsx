"use client";
import { useRuntimeTranslation } from "@/lib/i18n/runtime-locale";
import type { AppStateResponse } from "@/lib/api/api-contract-types";
import { BarChartLive } from "./bar-chart-live";
import { PollResults } from "./poll-results";
export function AppResults({ state }: { state: AppStateResponse }) {
  const tr = useRuntimeTranslation();
  return <div>{state.spec.blocks.some((b) => b.type === "compose") && <PollResults state={state} />}{state.results.map((result) => {
    if (!("type" in result)) return null;
    if (result.type === "quiz") return <section className="mini-card" key={result.blockId} aria-label={tr("Kết quả quiz")}><h2>{tr("Kết quả quiz")}</h2>{Object.entries(result.countsByQuestion).map(([id, counts]) => {
      const block = state.spec.blocks.find((b) => b.id === result.blockId);
      const question = block?.type === "quiz" ? block.questions.find((q) => q.id === id) : null;
      return question ? <div key={id}><h3>{question.prompt}</h3><p>{tr("{count} câu trả lời", { count: result.answeredByQuestion[id] ?? 0 })}</p><BarChartLive items={question.options.map((o) => ({ id: o.id, label: o.label, count: counts[o.id] ?? 0 }))} /></div> : null;
    })}{result.leaderboard.length > 0 && <><h3>{tr("Bảng xếp hạng")}</h3><table><thead><tr><th scope="col">{tr("Tên")}</th><th scope="col">{tr("Điểm")}</th></tr></thead><tbody>{result.leaderboard.map((entry, index) => <tr key={index}><td>{entry.name}</td><td>{entry.score}</td></tr>)}</tbody></table></>}{!result.leaderboard.length && <p>{tr("Chưa có điểm.")}</p>}</section>;
    return <section className="mini-card" key={result.blockId} aria-label={tr("Kết quả bốc thăm")}><h2>{tr("Kết quả bốc thăm")}</h2><p>{tr("{count} lựa chọn còn lại", { count: result.entries.length })}</p>{result.spins.length ? <ol aria-label={tr("Lịch sử bốc thăm")}>{result.spins.map((spin) => <li key={spin.spinId}>{spin.label}</li>)}</ol> : <p>{tr("Chưa quay số.")}</p>}</section>;
  })}</div>;
}
