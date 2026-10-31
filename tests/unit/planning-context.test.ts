import { expect, it } from "vitest";
import { planningContext, PlanningRequestSchema, type PlanningMessage } from "@/lib/api/planning-contract";

it.each([10, 1200])("keeps long chats valid with %i-character messages", length => {
  const messages: PlanningMessage[] = Array.from({ length: 41 }, (_, index) => ({
    role: index % 2 === 0 ? "user" : "assistant",
    content: `${index}:`.padEnd(length, "x"),
  }));
  const context = planningContext(messages);
  expect(PlanningRequestSchema.safeParse({ messages: context, currentBrief: "Agreed requirements", locale: "en" }).success).toBe(true);
  expect(context[0]).toEqual(messages[0]);
  expect(context.at(-1)).toEqual(messages.at(-1));
  expect(messages).toHaveLength(41);
});

it("preserves a conversation that already fits", () => {
  const messages: PlanningMessage[] = [{ role: "user", content: "Create a poll" }];
  expect(planningContext(messages)).toEqual(messages);
});
