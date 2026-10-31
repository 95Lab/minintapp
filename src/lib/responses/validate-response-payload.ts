import type { AppSpec } from "@/lib/app-spec/app-spec-schema";
import type { ResponsePayload } from "@/lib/blocks/block-registry";
import { AppError } from "@/lib/api/app-error-codes";
import { ENTRY_ITEM_ID } from "@/lib/blocks/compose/compose-atoms-schema";
import { shownInputs, validValue } from "@/lib/blocks/compose/compose-values";
export function validatePollResponse(spec: AppSpec, blockId: string, itemId: string, payload: ResponsePayload, runtime?: import("@/lib/blocks/block-definition-types").AppRuntime, now = Date.now()) {
  const block = spec.blocks.find((b) => b.id === blockId);
  if (!block || block.type !== "compose" || payload.kind !== "compose") throw new AppError("invalid_request");
  if (block.entries === "many" ? !ENTRY_ITEM_ID.test(itemId) : block.flow !== "steps" && itemId !== "") throw new AppError("invalid_request");
  if (payload.removed) {
    if (block.entries !== "many" || Object.keys(payload.values).length) throw new AppError("invalid_request");
    return;
  }
  let inputs = block.inputs;
  if (block.flow === "steps") {
    const step = runtime?.blocks[block.id]?.step;
    const current = inputs.find((i) => i.id === step?.current);
    if (!current || itemId !== current.id || step?.openedAt == null || (current.timeLimitSec && now > step.openedAt + current.timeLimitSec * 1000 + 2000)) throw new AppError("question_closed");
    inputs = [{ ...current, showIf: null }];
  }
  const visible = shownInputs(inputs, payload.values);
  if (Object.keys(payload.values).some((key) => !visible.some((i) => i.id === key)) || visible.some((i) => !validValue(i, payload.values[i.id]))) throw new AppError("invalid_request");
}

export function validateAppResponse(app: import("@/lib/db/apps-repository-types").AppRecord, response: Omit<import("@/lib/db/apps-repository-types").ResponseRecord, "createdAt">, now = Date.now()) {
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
  validatePollResponse(app.spec, response.blockId, response.itemId, payload, app.runtime, now);
}
