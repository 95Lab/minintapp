import type { AppSpec } from "@/lib/app-spec/app-spec-schema";
import type { ResponseRecord } from "@/lib/db/apps-repository-types";
export interface PollResult {
  blockId: string; viewId: string; kind: "bars";
  items: Array<{ id: string; label: string; count: number }>;
}
export function computePollResults(spec: AppSpec, rows: ResponseRecord[]): PollResult[] {
  return spec.blocks.flatMap((block) => block.type !== "compose" ? [] : block.views.flatMap((view) => {
    const input = block.inputs.find((i) => i.id === view.source);
    if (view.kind !== "bars" || input?.kind !== "choice") return [];
    const counts = new Map((input.options ?? []).map((o) => [o.id, 0]));
    for (const row of rows) {
      if (row.blockId !== block.id || row.payload.kind !== "compose") continue;
      const selected = row.payload.values[input.id];
      if (typeof selected === "string" && counts.has(selected)) counts.set(selected, counts.get(selected)! + 1);
    }
    return [{ blockId: block.id, viewId: view.id, kind: "bars" as const, items: (input.options ?? []).map((o) => ({ id: o.id, label: o.label, count: counts.get(o.id)! })) }];
  }));
}
