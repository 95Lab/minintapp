// Validates a participant submission against the app's spec and runtime state. Common checks
// (block exists, payload kind matches block, display name) live here; everything block-specific
// is delegated to the brick's definition in the registry.
import type { AppRecord } from "@/engine/db/apps-repository-types";
import type { SubmitResponseRequest } from "@/engine/api/api-contract-types";
import { blockDefinition } from "@/engine/blocks/block-registry";

export type ValidationError = "unknown_block" | "bad_payload" | "question_closed" | "name_required" | "too_long";

export function validateResponsePayload(app: AppRecord, req: SubmitResponseRequest): ValidationError | null {
  const block = app.spec.blocks.find((b) => b.id === req.blockId);
  if (!block) return "unknown_block";
  if (req.displayName && req.displayName.length > 40) return "too_long";
  if (app.spec.requireName && !req.displayName?.trim()) return "name_required";
  if (req.payload.kind !== block.type) return "bad_payload";
  return blockDefinition(block.type).validate(block, req.payload, { itemId: req.itemId, runtime: app.runtime });
}
