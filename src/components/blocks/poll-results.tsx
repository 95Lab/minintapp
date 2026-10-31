import type { AppStateResponse } from "@/lib/api/api-contract-types";
import { BarChartLive } from "./bar-chart-live";
export function PollResults({ state }: { state: AppStateResponse }) {
  return <section className="mini-card" aria-label="Kết quả bình chọn"><h2>Kết quả bình chọn</h2><p data-testid="participant-count">{state.participantCount} người tham gia</p>{state.results.filter((r) => "kind" in r).map((result) => <div key={`${result.blockId}:${result.viewId}`}><BarChartLive items={result.items} /></div>)}{!state.results.length && <p>Kết quả chưa được công bố.</p>}</section>;
}
