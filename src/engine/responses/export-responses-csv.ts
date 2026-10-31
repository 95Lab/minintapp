// "Keep the results, let the app go": every answer of an app as a CSV the host downloads before the
// app disappears. One row per answer: block, question / item, person, answer (worded like the screens
// show it), time. Check-ins and likes are bookkeeping, not answers, and are left out.
import type { AppSpec } from "@/engine/app-spec/app-spec-schema";
import type { ResponseRecord } from "@/engine/db/apps-repository-types";
import { formatComposeValue } from "@/engine/blocks/compose/compose-aggregation-helpers";
import { JOIN_ITEM_ID } from "@/engine/blocks/compose/compose-atoms-schema";
import { resultLabels } from "@/engine/i18n/result-labels-vi-en";

const HEADERS = { vi: ["Phần", "Câu / mục", "Người trả lời", "Câu trả lời", "Thời gian"], en: ["Block", "Question / item", "Participant", "Answer", "Time"] };

/** RFC 4180 cell; a leading = + - @ is defused so a spreadsheet never runs it as a formula. */
function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function exportResponsesCsv(spec: AppSpec, responses: ResponseRecord[]): string {
  const labels = resultLabels(spec.locale);
  const rows: string[][] = [];
  const sorted = [...responses].sort((a, b) => a.createdAt - b.createdAt);
  for (const r of sorted) {
    const block = spec.blocks.find((b) => b.id === r.blockId);
    if (!block) continue;
    const who = r.displayName || labels.anonymous;
    const at = new Date(r.createdAt).toISOString();
    if (block.type === "compose" && r.payload.kind === "compose") {
      const p = r.payload;
      if (r.itemId === JOIN_ITEM_ID || p.join || p.like || p.paid || p.removed) continue;
      const answer = block.inputs
        .filter((i) => p.values[i.id] !== undefined)
        .map((i) => `${i.label}: ${formatComposeValue(i, p.values[i.id], [], false, labels)}`)
        .join("; ");
      // steps: the item is the step (input) answered; buzzer presses carry "~<game>"
      const step = block.inputs.find((i) => i.id === r.itemId.split("~")[0]);
      rows.push([block.title, step?.label ?? "", who, answer, at]);
    } else if (block.type === "quiz" && r.payload.kind === "quiz") {
      const optionId = r.payload.optionId;
      const q = block.questions.find((x) => x.id === r.itemId);
      const picked = q?.options.find((o) => o.id === optionId)?.label ?? optionId;
      const verdict = q ? (q.correct === optionId ? "✓" : "✗") : "";
      rows.push(["Quiz", q?.prompt ?? r.itemId, who, `${picked} ${verdict}`.trim(), at]);
    } else if (block.type === "wheel") {
      rows.push([block.title, "", who, "✓", at]);
    } else if (block.type === "custom" && r.payload.kind === "custom") {
      rows.push([block.title, "", who, JSON.stringify(r.payload.value), at]);
    }
  }
  const lines = [HEADERS[spec.locale], ...rows].map((row) => row.map(cell).join(","));
  // BOM: Excel opens UTF-8 (Vietnamese) correctly only with it
  return `﻿${lines.join("\r\n")}\r\n`;
}
