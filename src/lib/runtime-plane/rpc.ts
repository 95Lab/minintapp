import { z } from "zod";
import { BlockActionRequestSchema } from "@/lib/api/request-schemas";
import { ResponsePayloadSchema } from "@/lib/blocks/block-registry";
const Token = z.string().min(1).max(128);
import { RuntimeSnapshotSchema } from "./snapshot-schema";
export const RuntimeRPCSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("compareAndSwap"), args: z.tuple([z.number().int().positive(), RuntimeSnapshotSchema]) }),
  z.object({ op: z.literal("snapshot"), args: z.tuple([]) }),
  z.object({ op: z.literal("listResponses"), args: z.tuple([]) }),
  z.object({ op: z.literal("transition"), args: z.tuple([Token, z.enum(["close", "reopen", "end"])]) }),
  z.object({ op: z.literal("blockAction"), args: z.tuple([Token, BlockActionRequestSchema]) }),
  z.object({ op: z.literal("submitResponse"), args: z.tuple([z.object({
    blockId: z.string().max(40), itemId: z.string().max(40), participantHash: z.string().regex(/^[a-f0-9]{64}$/),
    displayName: z.string().max(40).nullable(), payload: ResponsePayloadSchema,
  })]) }),
]);
