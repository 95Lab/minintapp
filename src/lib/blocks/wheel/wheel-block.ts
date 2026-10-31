import { z } from "zod";
import { Id, Text, OptionSchema, uniqueIds } from "../block-schema-primitives";
export const WheelBlockSchema = z.strictObject({
  type: z.literal("wheel"), id: Id, title: Text, source: z.enum(["options", "participants"]),
  options: z.array(OptionSchema).max(30), removeWinner: z.boolean(),
}).refine((b) => uniqueIds(b.options) && (b.source === "participants" || b.options.length >= 2), {
  message: "Wheel options need unique ids and at least two entries for source=options",
});
export const WheelPayloadSchema = z.strictObject({ kind: z.literal("wheel"), join: z.literal(true) });
export type WheelBlock = z.infer<typeof WheelBlockSchema>;
export type WheelPayload = z.infer<typeof WheelPayloadSchema>;
export interface WheelSpin { spinId: string; entryId: string; label: string; at: number }
