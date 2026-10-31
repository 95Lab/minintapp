import type { AppStateResponse } from "@/lib/api/api-contract-types";
import { BarChartLive } from "./bar-chart-live";
import { PollResults } from "./poll-results";
export function AppResults({ state }: { state: AppStateResponse }) {
  return <div>{state.spec.blocks.some((b) => b.type === "compose") && <PollResults state={state} />}{state.results.map((result) => {
    if (!("type" in result)) return null;
    if (result.type === "quiz") return <section className="mini-card" key={result.blockId} aria-label="Kết quả quiz"><h2>Kết quả quiz</h2>{Object.entries(result.answeredByQuestion).map(([id, count]) => <p key={id}>{id}: {count} câu trả lời</p>)}{Object.entries(result.countsByQuestion).map(([id, counts]) => {
      const block = state.spec.blocks.find((b) => b.id === result.blockId);
      const question = block?.type === "quiz" ? block.questions.find((q) => q.id === id) : null;
      return question ? <div key={id}><h3>{question.prompt}</h3><BarChartLive items={question.options.map((o) => ({ id: o.id, label: o.label, count: counts[o.id] ?? 0 }))} /></div> : null;
    })}{result.leaderboard.length > 0 && <><h3>Bảng xếp hạng</h3><table><thead><tr><th scope="col">Tên</th><th scope="col">Điểm</th></tr></thead><tbody>{result.leaderboard.map((entry, index) => <tr key={index}><td>{entry.name}</td><td>{entry.score}</td></tr>)}</tbody></table></>}{!result.leaderboard.length && <p>Chưa có điểm.</p>}</section>;
    return <section className="mini-card" key={result.blockId} aria-label="Kết quả bốc thăm"><h2>Kết quả bốc thăm</h2><p>{result.entries.length} lựa chọn còn lại</p>{result.spins.length ? <ol aria-label="Lịch sử bốc thăm">{result.spins.map((spin) => <li key={spin.spinId}>{spin.label}</li>)}</ol> : <p>Chưa quay số.</p>}</section>;
  })}</div>;
}
