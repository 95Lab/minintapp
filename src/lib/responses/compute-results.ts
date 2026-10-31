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

import type { AppRuntime } from "@/lib/blocks/block-definition-types";
import type { QuizBlock } from "@/lib/blocks/quiz/quiz-block";
import type { WheelBlock, WheelSpin } from "@/lib/blocks/wheel/wheel-block";
export interface QuizResults {
  type: "quiz"; blockId: string;
  answeredByQuestion: Record<string, number>;
  countsByQuestion: Record<string, Record<string, number>>;
  leaderboard: Array<{ name: string; score: number }>;
}
export interface WheelResults {
  type: "wheel"; blockId: string;
  entries: Array<{ id: string; label: string }>;
  spins: WheelSpin[];
}
export type BlockResults = PollResult | QuizResults | WheelResults;
export function computeQuizResults(block: QuizBlock, rows: ResponseRecord[], runtime: AppRuntime, isHost: boolean, locale: AppSpec["locale"]): QuizResults {
  const answeredByQuestion: Record<string, number> = Object.create(null);
  const countsByQuestion: Record<string, Record<string, number>> = Object.create(null);
  const scores = new Map<string, { name: string; score: number }>();
  for (const question of block.questions) {
    answeredByQuestion[question.id] = 0;
    if (isHost || runtime.revealedQuestionIds.includes(question.id)) countsByQuestion[question.id] = Object.fromEntries(question.options.map((o) => [o.id, 0]));
  }
  for (const row of rows) {
    if (row.blockId !== block.id || row.payload.kind !== "quiz") continue;
    const question = block.questions.find((q) => q.id === row.itemId);
    if (!question) continue;
    answeredByQuestion[question.id]++;
    const counts = countsByQuestion[question.id];
    if (counts && Object.hasOwn(counts, row.payload.optionId)) counts[row.payload.optionId]++;
    const player = scores.get(row.participantHash) ?? { name: row.displayName || (locale === "vi" ? "Ẩn danh" : "Anonymous"), score: 0 };
    if (runtime.revealedQuestionIds.includes(question.id) && row.payload.optionId === question.correct) player.score += question.points;
    scores.set(row.participantHash, player);
  }
  return { type: "quiz", blockId: block.id, answeredByQuestion, countsByQuestion, leaderboard: block.leaderboard ? [...scores.values()].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, 10) : [] };
}
export function wheelCandidates(block: WheelBlock, rows: ResponseRecord[], runtime: AppRuntime) {
  const entries = block.source === "options" ? block.options : rows.filter((r) => r.blockId === block.id && r.payload.kind === "wheel").map((r, i) => ({ id: r.participantHash.slice(0, 16), label: r.displayName || `Ẩn danh #${i + 1}` }));
  const state = runtime.blocks[block.id];
  const removed = new Set(state?.removedEntryIds ?? state?.spins?.map((s) => s.entryId) ?? []);
  return block.removeWinner ? entries.filter((e) => !removed.has(e.id)) : entries;
}
export function computeResults(spec: AppSpec, rows: ResponseRecord[], runtime: AppRuntime, isHost: boolean): BlockResults[] {
  const results: BlockResults[] = computePollResults(spec, rows);
  for (const block of spec.blocks) {
    if (block.type === "quiz") results.push(computeQuizResults(block, rows, runtime, isHost, spec.locale));
    if (block.type === "wheel") results.push({ type: "wheel", blockId: block.id, entries: wheelCandidates(block, rows, runtime), spins: runtime.blocks[block.id]?.spins ?? [] });
  }
  return results;
}
