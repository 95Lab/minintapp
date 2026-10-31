import type { ComposeView } from "@/lib/blocks/compose/compose-atoms-schema";
import { BarChartLive } from "./bar-chart-live";
import { WordCloud } from "./word-cloud";
// Caller supplies already-authorized server results. Hidden values must never reach this component.
export type ComposeViewData =
  | { kind: "bars"; items: { id: string; label: string; count: number }[] }
  | { kind: "cloud"; words: { text: string; count: number }[] }
  | { kind: "stat"; value: number }
  | { kind: "table" | "leaderboard"; rows: { id: string; label: string; value: string | number }[] };
export function ComposeViewRenderer({ view, data }: { view: ComposeView; data: ComposeViewData | null }) {
  if (!data) return <p>Kết quả chưa được công bố.</p>;
  if (data.kind !== view.kind) return <p role="alert">Dữ liệu không khớp chế độ xem.</p>;
  return <section className="mini-card"><h3>{view.title ?? "Kết quả"}</h3>{data.kind === "bars" ? <BarChartLive items={data.items} /> : data.kind === "cloud" ? <WordCloud words={data.words} /> : data.kind === "stat" ? <output>{data.value}</output> : <table><thead><tr><th scope="col">Nhãn</th><th scope="col">Giá trị</th></tr></thead><tbody>{data.rows.map((r) => <tr key={r.id}><th scope="row">{r.label}</th><td>{r.value}</td></tr>)}</tbody></table>}</section>;
}
