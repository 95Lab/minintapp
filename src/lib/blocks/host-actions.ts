import "server-only";
import { randomInt, randomUUID } from "node:crypto";
import type { BlockActionRequest } from "@/lib/api/api-contract-types";
import type { AppRecord, ResponseRecord } from "@/lib/db/apps-repository-types";
import { AppError } from "@/lib/api/app-error-codes";
import { wheelCandidates } from "@/lib/responses/compute-results";
// Called within the repository's synchronous mutation section, after authorization.
export function applyHostAction(app: AppRecord, rows: ResponseRecord[], input: BlockActionRequest, now: number) {
  const block = app.spec.blocks.find((b) => b.id === input.blockId);
  if (!block) throw new AppError("invalid_request");
  if (block.type === "quiz" && (input.action === "open" || input.action === "reveal")) {
    const questionId = input.args?.questionId;
    if (typeof questionId !== "string" || !block.questions.some((q) => q.id === questionId)) throw new AppError("invalid_request");
    if (input.action === "open") {
      app.runtime.openQuestionId = questionId;
      app.runtime.revealedQuestionIds = app.runtime.revealedQuestionIds.filter((id) => id !== questionId);
    } else if (!app.runtime.revealedQuestionIds.includes(questionId)) app.runtime.revealedQuestionIds.push(questionId);
    return;
  }
  if (block.type === "compose" && block.flow === "steps") {
    const previous = app.runtime.blocks[block.id] ?? {};
    const step = previous.step ?? { current: null, openedAt: null, done: [] };
    if (input.action === "restart") { app.runtime.blocks[block.id] = { ...previous, step: { current: null, openedAt: null, done: [] } }; return; }
    const done = [...new Set([...step.done, ...(step.current ? [step.current] : [])])];
    if (input.action === "close" && step.current) { app.runtime.blocks[block.id] = { ...previous, step: { current: null, openedAt: null, done } }; return; }
    if (input.action === "next") {
      const next = block.inputs.find((i) => !done.includes(i.id));
      if (!next) throw new AppError("invalid_request");
      app.runtime.blocks[block.id] = { ...previous, step: { current: next.id, openedAt: now, done } }; return;
    }
    throw new AppError("invalid_request");
  }
  if (block.type === "wheel") {
    if (input.action === "reset") { app.runtime.blocks[block.id] = { spins: [], removedEntryIds: [] }; return; }
    if (input.action === "spin") {
      const entries = wheelCandidates(block, rows, app.runtime);
      if (!entries.length) throw new AppError(block.source === "participants" ? "wheel_no_entrants" : "wheel_empty");
      const winner = entries[randomInt(entries.length)];
      const state = app.runtime.blocks[block.id] ?? { spins: [] };
      app.runtime.blocks[block.id] = {
        spins: [...state.spins ?? [], { spinId: randomUUID(), entryId: winner.id, label: winner.label, at: now }].slice(-50),
        removedEntryIds: block.removeWinner ? [...state.removedEntryIds ?? [], winner.id] : [],
      };
      return;
    }
  }
  throw new AppError("invalid_request");
}
