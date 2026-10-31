import { z } from "zod";
import { BlockSchema } from "@/lib/blocks/block-registry";
import { Text, uniqueIds } from "@/lib/blocks/block-schema-primitives";
export const MAX_BLOCKS = 6;
export const AppSpecSchema = z.strictObject({
  specVersion: z.literal(1), locale: z.enum(["vi", "en"]), title: Text, description: Text.nullable(),
  theme: z.enum(["ink", "sunset", "ocean", "forest"]), requireName: z.boolean(),
  layout: z.enum(["stack", "tabs"]), blocks: z.array(BlockSchema).min(1).max(MAX_BLOCKS),
}).superRefine((spec, ctx) => {
  const questionIds = spec.blocks.flatMap((b) => b.type === "quiz" ? b.questions : []);
  if (!uniqueIds(questionIds)) ctx.addIssue({ code: "custom", path: ["blocks"], message: "Quiz question ids must be unique across the app" });
  if (!uniqueIds(spec.blocks)) ctx.addIssue({ code: "custom", path: ["blocks"], message: "Duplicate block ids" });
  if (!spec.requireName && spec.blocks.some((b) => b.type === "wheel" && b.source === "participants")) {
    ctx.addIssue({ code: "custom", path: ["requireName"], message: "Participant wheel requires names" });
  }
});
export const RuntimeAppSpecSchema = AppSpecSchema;
export type AppSpec = z.infer<typeof AppSpecSchema>;
export type Locale = AppSpec["locale"];
export type ThemeName = AppSpec["theme"];
