import type { AppStateResponse } from "@/lib/api/api-contract-types";
import { ComposeViewRenderer } from "./compose-view-renderer";
export function PollResults({ state }: { state: AppStateResponse }) {
  const results = state.results.filter((r) => "kind" in r);
  return <section className="mini-card" aria-label="Kết quả bình chọn"><h2>Kết quả bình chọn</h2><p data-testid="participant-count">{state.participantCount} người tham gia</p>{results.map((result) => {
    const block = state.spec.blocks.find((b) => b.id === result.blockId);
    const view = block?.type === "compose" ? block.views.find((v) => v.id === result.viewId) : null;
    return view ? <ComposeViewRenderer key={`${result.blockId}:${result.viewId}`} view={view} data={result} /> : null;
  })}{!results.length && <p>Kết quả chưa được công bố.</p>}</section>;
}
