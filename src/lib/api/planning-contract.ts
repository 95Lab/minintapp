import { z } from "zod";

export const PlanningMessageSchema = z.strictObject({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(1600),
});
export const PlanningRequestSchema = z.strictObject({
  locale: z.enum(["vi", "en"]),
  messages: z.array(PlanningMessageSchema).min(1).max(25),
  currentBrief: z.string().trim().min(1).max(500).nullable(),
}).superRefine((value, ctx) => {
  if (value.messages.some((message, index) => message.role !== (index % 2 === 0 ? "user" : "assistant"))) {
    ctx.addIssue({ code: "custom", message: "Messages must alternate, starting with the user" });
  }
  if (value.messages.at(-1)?.role !== "user" || value.messages.reduce((sum, message) => sum + message.content.length, 0) > 5000) {
    ctx.addIssue({ code: "custom", message: "Invalid conversation length" });
  }
});
// Keep the wire shape simple for Structured Outputs; validate state invariants locally.
export const PlanningReplyWireSchema = z.strictObject({
  status: z.enum(["clarify", "ready", "unsupported"]),
  message: z.string().trim().min(1).max(1200),
  suggestions: z.array(z.string().trim().min(1).max(160)).max(3),
  brief: z.string().trim().min(1).max(500).nullable(),
});
export const PlanningReplySchema = PlanningReplyWireSchema.superRefine((value, ctx) => {
  if (value.status === "ready" && !value.brief || value.status === "unsupported" && value.brief !== null) {
    ctx.addIssue({ code: "custom", message: "Invalid planning state" });
  }
});
export type PlanningMessage = z.infer<typeof PlanningMessageSchema>;
export type PlanningRequest = z.infer<typeof PlanningRequestSchema>;
export type PlanningReply = z.infer<typeof PlanningReplySchema>;
