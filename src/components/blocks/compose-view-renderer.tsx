"use client";
import { useRuntimeTranslation } from "@/lib/i18n/runtime-locale";
import type { ComposeView } from "@/lib/blocks/compose/compose-atoms-schema";
import type { ComposeResult } from "@/lib/blocks/compose/compute-compose-results";
import { BarChartLive } from "./bar-chart-live";
import { WordCloud } from "./word-cloud";
export type ComposeViewData = ComposeResult;
export function ComposeViewRenderer({ view, data }: { view: ComposeView; data: ComposeViewData | null }) {
  const tr = useRuntimeTranslation();
  if (!data) return <p>{tr("Kết quả chưa được công bố.")}</p>;
  if (data.kind !== view.kind) return <p role="alert">{tr("Dữ liệu không khớp chế độ xem.")}</p>;
  return <section className="mini-card"><h3>{view.title ?? tr("Kết quả")}</h3>{data.kind === "bars" ? <BarChartLive items={data.items} /> : data.kind === "cloud" ? <WordCloud words={data.words ?? []} /> : data.kind === "stat" ? <output>{data.value == null ? "—" : String(data.value)}</output> : <table><thead><tr><th scope="col">{tr("Nhãn")}</th>{data.columns?.map((c) => <th scope="col" key={c.key}>{c.label}</th>)}</tr></thead><tbody>{data.rows?.map((r) => <tr key={r.id}><th scope="row">{r.label}</th>{data.columns?.map((c) => <td key={c.key}>{r.values[c.key] == null ? "—" : String(r.values[c.key])}</td>)}</tr>)}</tbody></table>}</section>;
}
