import { z } from "zod";
import { Id, Text, uniqueIds } from "../block-schema-primitives";
import { ComposeInputSchema, ComposeViewSchema } from "./compose-atoms-schema";
import { queryIssues } from "./compose-query-engine";
export const ComposeBlockSchema = z.strictObject({
  type: z.literal("compose"), id: Id, title: Text, note: Text.nullable(),
  inputs: z.array(ComposeInputSchema).min(1).max(8), views: z.array(ComposeViewSchema).min(1).max(4),
  entries: z.enum(["one", "many"]), flow: z.enum(["open", "steps"]),
}).superRefine((b, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: "custom", message });
  if (b.entries === "many" && b.flow === "steps") issue("Multiple entries cannot use steps");
  if (!uniqueIds(b.inputs) || !uniqueIds(b.views)) issue("Duplicate input or view ids");
  for (const input of b.inputs) {
    if (input.min !== null && input.max !== null && input.min > input.max) issue("Invalid input range");
    if (["choice", "slot"].includes(input.kind) && !input.options) issue("Choice/slot requires options");
    if (input.options && !uniqueIds(input.options)) issue("Duplicate option ids");
    if (input.kind === "slot" && input.capacity === null) issue("Slot requires capacity");
    if (input.kind === "rating" && (input.max === null || !Number.isInteger(input.max) || input.max < 3 || input.max > 10)) issue("Rating max must be 3–10");
    if (input.showIf) {
      const earlier = b.inputs.slice(0, b.inputs.indexOf(input)).find((i) => i.id === input.showIf?.input);
      if (!earlier || !["choice", "slot"].includes(earlier.kind) || !earlier.options?.some((o) => o.id === input.showIf?.equals)) issue("Invalid conditional input");
    }
  }
  for (const view of b.views) {
    if (view.kind === "summary") {
      if (view.source !== null) issue("Summary source must be null");
      if (!view.query) issue("Summary requires query");
      else for (const message of queryIssues(view.query, b.inputs)) issue(message);
      continue;
    }
    if (view.query) issue("Only summary accepts query");
    const source = b.inputs.find((input) => input.id === view.source);
    if (view.source !== null && !source) issue("Unknown view source");
    if (view.kind === "table") continue;
    if (view.kind === "stat" && view.op === "count") continue;
    if (!source) { issue("View requires a source"); continue; }
    if (view.kind === "bars" && !["choice", "slot", "rating"].includes(source.kind)) issue("Bars require choice, slot or rating");
    if (view.kind === "cloud" && source.kind !== "text") issue("Cloud requires text");
    if (["stat", "leaderboard"].includes(view.kind) && !["number", "rating"].includes(source.kind)) issue("Numeric view requires number or rating");
    if (view.kind === "stat" && view.op === null) issue("Stat requires an operation");
  }
});
export type ComposeBlock = z.infer<typeof ComposeBlockSchema>;
