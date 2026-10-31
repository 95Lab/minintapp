"use client";
import { useRuntimeTranslation } from "@/lib/i18n/runtime-locale";
import type { AppStateResponse } from "@/lib/api/api-contract-types";
import { ComposeViewRenderer } from "./compose-view-renderer";
export function PollResults({ state }: { state: AppStateResponse }) {
  const tr = useRuntimeTranslation();
  const results = state.results.filter((r) => "kind" in r);
  return <section className="mini-card" aria-label={tr("Kết quả bình chọn")}><h2>{tr("Kết quả bình chọn")}</h2><p data-testid="participant-count">{tr("{count} người tham gia", { count: state.participantCount })}</p>{results.map((result) => {
    const block = state.spec.blocks.find((b) => b.id === result.blockId);
    const view = block?.type === "compose" ? block.views.find((v) => v.id === result.viewId) : null;
    return view ? <ComposeViewRenderer key={`${result.blockId}:${result.viewId}`} view={view} data={result} /> : null;
  })}{!results.length && <p>{tr("Kết quả chưa được công bố.")}</p>}</section>;
}
