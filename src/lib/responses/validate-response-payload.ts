import type { AppSpec } from "@/lib/app-spec/app-spec-schema";
import type { ResponsePayload } from "@/lib/blocks/block-registry";
import { AppError } from "@/lib/api/app-error-codes";
// This milestone accepts one single-choice poll record per participant only.
export function validatePollResponse(spec: AppSpec, blockId: string, itemId: string, payload: ResponsePayload) {
  const block = spec.blocks.find((b) => b.id === blockId);
  if (!block || block.type !== "compose" || payload.kind !== "compose" || itemId !== "" || block.inputs.length !== 1) throw new AppError("invalid_request");
  const input = block.inputs[0];
  if (input.kind !== "choice" || input.multi || input.showIf || Object.keys(payload.values).length !== 1) throw new AppError("invalid_request");
  const value = payload.values[input.id];
  if (typeof value !== "string" || !input.options?.some((o) => o.id === value)) throw new AppError("invalid_request");
}

export function validateAppResponse(app: import("@/lib/db/apps-repository-types").AppRecord, response: Omit<import("@/lib/db/apps-repository-types").ResponseRecord, "createdAt">) {
  const block = app.spec.blocks.find((b) => b.id === response.blockId);
  if (!block) throw new AppError("invalid_request");
  if (app.spec.requireName && !response.displayName?.trim()) throw new AppError("invalid_request");
  const payload = response.payload;
  if (block.type === "quiz" && payload.kind === "quiz") {
    const question = block.questions.find((q) => q.id === response.itemId);
    if (!question || !question.options.some((o) => o.id === payload.optionId)) throw new AppError("invalid_request");
    if (app.runtime.openQuestionId !== question.id || app.runtime.revealedQuestionIds.includes(question.id)) throw new AppError("question_closed");
    return;
  }
  if (block.type === "wheel" && payload.kind === "wheel" && block.source === "participants" && response.itemId === "") return;
  validatePollResponse(app.spec, response.blockId, response.itemId, payload);
}
