import { z } from "zod";
import { RuntimeSeedSchema } from "../../../platform/contracts";
import { ResponsePayloadSchema as EnginePayload } from "@/engine/blocks/block-registry";
import { ResponsePayloadSchema } from "@/lib/blocks/block-registry";
import type { AppSnapshot } from "@/lib/db/apps-repository-types";
const Raw = z.object({
  app: RuntimeSeedSchema.extend({ status: z.enum(["active", "closed", "ended", "blocked"]), stateVersion: z.number().int().positive(),
    runtime: z.object({ openQuestionId: z.string().nullable(), revealedQuestionIds: z.array(z.string()), blocks: z.record(z.string(), z.unknown()).optional() }),
    parentId: z.string().nullable(), movedTo: z.string().nullable(), endedAt: z.number().nullable(), announcement: z.object({ text: z.string(), at: z.number() }).nullable(),
  }).passthrough(),
  responses: z.array(z.object({ blockId: z.string(), itemId: z.string(), participantHash: z.string().regex(/^[a-f0-9]{64}$/), displayName: z.string().nullable(),
    createdAt: z.number(), payload: z.union([ResponsePayloadSchema, EnginePayload]), })).max(1000),
  extension: z.object({ reports: z.record(z.string(), z.string()).optional(), photos: z.record(z.string(), z.object({
    participantHash: z.string(), mime: z.string(), path: z.string().optional(), base64: z.string().max(900000).optional(),
  })).optional() }).optional(),
});
// Base repository retains the legacy public type while the engine stores its wider validated spec.
export const RuntimeSnapshotSchema = Raw.transform((snapshot) => snapshot as unknown as AppSnapshot);
