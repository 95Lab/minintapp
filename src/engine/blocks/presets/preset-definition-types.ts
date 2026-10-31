// A preset is AI/template vocabulary, not a runtime brick: a short, well-known shape ("choice" poll,
// "collect" group order, "open_text" word cloud) that the model fills reliably, and that
// AppSpecSchema expands into a `compose` block before the app is stored. Everything that runs
// (answers, results, UI, security scan) therefore goes through compose.
import type { z } from "zod";
import type { LlmField } from "../block-definition-types";
import type { ComposeBlock } from "../compose/compose-block";

export interface PresetDefinition<P extends { type: string; id: string }> {
  type: P["type"];
  label: { vi: string; en: string };
  /** One entry of the "available bricks" list in the system prompt (VN/EN). */
  promptDoc: string;
  promptRules?: string;
  specSchema: z.ZodType<P>;
  llmFields: Record<string, LlmField>;
  fromFlat(flat: Record<string, unknown> & { id: string }): P;
  toFlat(block: P): Record<string, unknown>;
  /** The compose block this preset stands for (keeps the preset's id). */
  expand(block: P): ComposeBlock;
}

/** Stable, regex-safe ids for options that only have a label (e.g. "Trà sữa" → "tra-sua"), unique within the list. */
export function optionIdsFromLabels(labels: string[]): string[] {
  const used = new Set<string>();
  return labels.map((label, i) => {
    const base =
      label
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/đ/gi, "d")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 30) || `opt-${i + 1}`;
    let id = base;
    for (let n = 2; used.has(id); n += 1) id = `${base}-${n}`;
    used.add(id);
    return id;
  });
}
