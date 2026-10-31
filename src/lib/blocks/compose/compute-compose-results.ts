import type { ComposeBlock } from "./compose-block";
import type { ResponseRecord } from "@/lib/db/apps-repository-types";
import { aggregate, runQuery } from "./compose-query-engine";
import type { Cell } from "./expression/expr-types";
export interface ComposeResult {
  blockId: string; viewId: string; kind: "bars" | "stat" | "cloud" | "table" | "leaderboard" | "summary";
  items: { id: string; label: string; count: number }[];
  value?: Cell; words?: { text: string; count: number }[];
  columns?: { key: string; label: string }[];
  rows?: { id: string; label: string; values: Record<string, Cell> }[];
}
export function computeComposeResults(block: ComposeBlock, responses: ResponseRecord[]): ComposeResult[] {
  // Steps store one row per input; combine those into a single participant record for summaries.
  const records = new Map<string, { participantHash: string; name: string | null; values: Record<string, Cell> }>();
  for (const r of responses) {
    if (r.blockId !== block.id || r.payload.kind !== "compose" || r.payload.removed) continue;
    const key = JSON.stringify([r.participantHash, block.flow === "steps" ? "" : r.itemId]);
    const record = records.get(key) ?? { participantHash: r.participantHash, name: r.displayName, values: {} };
    Object.assign(record.values, r.payload.values); records.set(key, record);
  }
  const rows = [...records.values()];
  return block.views.map((view) => {
    const result: ComposeResult = { blockId: block.id, viewId: view.id, kind: view.kind, items: [] };
    const source = block.inputs.find((i) => i.id === view.source);
    const values = rows.map((r) => source ? r.values[source.id] ?? null : 1);
    if (view.kind === "bars" && source) {
      const options = source.kind === "rating" ? Array.from({ length: source.max ?? 5 }, (_, i) => ({ id: String(i + 1), label: String(i + 1) })) : source.options ?? [];
      result.items = options.map((o) => ({ ...o, count: values.filter((v) => Array.isArray(v) ? v.includes(o.id) : String(v) === o.id).length }));
    } else if (view.kind === "stat") result.value = aggregate(view.op ?? "count", values, !source);
    else if (view.kind === "cloud") {
      const counts = new Map<string, number>();
      for (const value of values) if (typeof value === "string") for (const word of value.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []) counts.set(word, (counts.get(word) ?? 0) + 1);
      result.words = [...counts].sort((a, b) => b[1] - a[1]).slice(0, view.topN ?? 50).map(([text, count]) => ({ text, count }));
    } else if (view.kind === "summary" && view.query) {
      const query = runQuery(view.query, rows, block.inputs);
      result.columns = [...view.query.measures, ...view.query.derived].map((m) => ({ key: m.key, label: m.label ?? m.key }));
      const groupInput = block.inputs.find((i) => i.id === view.query?.groupBy);
      if (view.query.groupBy === null && query.groups.length === 0) query.groups.push({key:"",name:null,values:query.totals});
      result.rows = query.groups.map((g, i) => ({ id: String(i), label: view.query?.groupBy === "$participant" ? g.name ?? "Ẩn danh" : groupInput?.options?.find((o) => o.id === g.key)?.label ?? (g.key || "Tổng"), values: g.values }));
    } else if (view.kind === "table" || view.kind === "leaderboard") {
      const inputs = source ? [source] : block.inputs;
      result.columns = inputs.map((i) => ({ key: i.id, label: i.label }));
      const scored = new Map<string,typeof rows[number]>();
      if(view.kind === "leaderboard" && source) for(const row of rows) {
        const previous=scored.get(row.participantHash);
        const entries=rows.filter(r=>r.participantHash===row.participantHash).map(r=>r.values[source.id]??null);
        if(!previous)scored.set(row.participantHash,{...row,values:{[source.id]:aggregate(view.op??"sum",entries)}});
      }
      const rankingRows=view.kind === "leaderboard"?[...scored.values()]:rows;
      const sorted = view.kind === "leaderboard" && source ? [...rankingRows].sort((a, b) => Number(b.values[source.id] ?? 0) - Number(a.values[source.id] ?? 0)) : rankingRows;
      result.rows = sorted.slice(0, view.topN ?? 50).map((r, index) => ({ id: String(index), label: r.name ?? "Ẩn danh", values: Object.fromEntries(inputs.map((i) => {
        const v = r.values[i.id] ?? null;
        const label = (value: string) => i.options?.find((o) => o.id === value)?.label ?? value;
        return [i.id, Array.isArray(v) ? v.map(label).join(", ") : typeof v === "string" ? label(v) : v];
      })) }));
    }
    return result;
  });
}
