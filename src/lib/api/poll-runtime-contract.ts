import { z } from "zod";
export const PollVoteRequestSchema = z.strictObject({
  optionId: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
  displayName: z.string().trim().min(1).max(80).optional(),
});
export const PollHostActionSchema = z.strictObject({ action: z.enum(["close", "reopen", "end"]) });
export const PollRuntimeStateSchema = z.strictObject({
  title: z.string(), description: z.string().nullable(), blockTitle: z.string(), note: z.string().nullable(),
  question: z.string(), resultsTitle: z.string(), locale: z.enum(["vi", "en"]),
  theme: z.enum(["ink", "sunset", "ocean", "forest"]), requireName: z.boolean(),
  options: z.array(z.strictObject({ id: z.string(), label: z.string() })),
  expiresAt: z.number(), status: z.enum(["open", "closed"]),
  myOptionId: z.string().nullable(), myDisplayName: z.string().nullable(),
  results: z.strictObject({ total: z.number().int().nonnegative(), counts: z.record(z.string(), z.number().int().nonnegative()) }).nullable(),
});
export type PollVoteRequest = z.infer<typeof PollVoteRequestSchema>;
export type PollHostAction = z.infer<typeof PollHostActionSchema>;
export type PollRuntimeState = z.infer<typeof PollRuntimeStateSchema>;
