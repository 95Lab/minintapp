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
