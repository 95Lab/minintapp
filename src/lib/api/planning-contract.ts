import { z } from "zod";
export const PLANNING_TIMEOUT_MS = 25_000;
export const PLANNING_MAX_MESSAGES = 25;
export const PLANNING_MAX_CHARACTERS = 5000;
export const PlanningErrorCodeSchema = z.enum(["invalid_request", "ai_not_configured", "ai_timeout", "ai_refused", "ai_invalid_output", "ai_unavailable", "rate_limited"]);

export const PlanningMessageSchema = z.strictObject({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(1600),
});
export const PlanningRequestSchema = z.strictObject({
  locale: z.enum(["vi", "en"]),
  messages: z.array(PlanningMessageSchema).min(1).max(PLANNING_MAX_MESSAGES),
  currentBrief: z.string().trim().min(1).max(500).nullable(),
}).superRefine((value, ctx) => {
  if (value.messages.some((message, index) => message.role !== (index % 2 === 0 ? "user" : "assistant"))) {
    ctx.addIssue({ code: "custom", message: "Messages must alternate, starting with the user" });
  }
  if (value.messages.at(-1)?.role !== "user" || value.messages.reduce((sum, message) => sum + message.content.length, 0) > PLANNING_MAX_CHARACTERS) {
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

// Keep the original idea and recent complete turns. The standalone currentBrief
// carries agreed requirements from older turns; the UI retains the full log.
export function planningContext(messages: PlanningMessage[]): PlanningMessage[] {
  const context = [...messages];
  while (context.length > 3 && (context.length > PLANNING_MAX_MESSAGES || context.reduce((sum, message) => sum + message.content.length, 0) > PLANNING_MAX_CHARACTERS)) {
    context.splice(2, 2);
  }
  return context;
}
