// AppSpec v1 — the central contract, in two forms:
//  - AppSpecDraft: what an author writes (LLM, template, keyword mock). May use presets
//    (choice, collect, open_text) — see src/lib/blocks/block-vocabulary.ts.
//  - AppSpec: what is stored and run. AppSpecSchema parses a draft, expands presets into `compose`,
//    and re-validates, so runtime code only ever sees compose / quiz / wheel.
// No field may carry URLs, HTML, CSS or JS: every Text is rendered escaped.
import { z } from "zod";
import { BlockSchema } from "@/engine/blocks/block-registry";
import { DraftBlockSchema, expandDraftBlock } from "@/engine/blocks/block-vocabulary";
import { needsRoster } from "@/engine/blocks/compose/compose-wiring-rules";
import { Text } from "@/engine/blocks/block-schema-primitives";

export { BlockSchema, DraftBlockSchema };
export { OptionSchema } from "@/engine/blocks/block-schema-primitives";
export { QuizBlockSchema, QuizQuestionSchema, type QuizBlock, type QuizQuestion } from "@/engine/blocks/quiz/quiz-block";
export { WheelBlockSchema, type WheelBlock } from "@/engine/blocks/wheel/wheel-block";
export { CustomBlockSchema, type CustomBlock } from "@/engine/blocks/custom/custom-block";
export { LiveBlockSchema, type LiveBlock } from "@/engine/blocks/live/live-block";
export { ComposeBlockSchema, type ComposeBlock } from "@/engine/blocks/compose/compose-block";
export type { ComposeInput, ComposeOption, ComposeView } from "@/engine/blocks/compose/compose-atoms-schema";
export { ChoiceBlockSchema, type ChoiceBlock } from "@/engine/blocks/presets/choice-preset";
export { CollectBlockSchema, CollectFieldSchema, type CollectBlock, type CollectField } from "@/engine/blocks/presets/collect-preset";
export { OpenTextBlockSchema, type OpenTextBlock } from "@/engine/blocks/presets/open-text-preset";
export type { Block, BlockType } from "@/engine/blocks/block-registry";
export type { DraftBlock, VocabularyType } from "@/engine/blocks/block-vocabulary";

const specFields = {
  specVersion: z.literal(1),
  locale: z.enum(["vi", "en"]),
  title: Text,
  description: Text.nullable(),
  theme: z.enum(["ink", "sunset", "ocean", "forest"]),
  requireName: z.boolean(),
  /** "tabs" shows one block at a time behind a tab bar; specs stored before this field load as "stack". */
  layout: z.enum(["stack", "tabs"]).default("stack"),
};

/** Most blocks an app may have. */
export const MAX_BLOCKS = 6;

export const AppSpecDraftSchema = z.object({ ...specFields, blocks: z.array(DraftBlockSchema).min(1).max(MAX_BLOCKS) });
/** What authors write: optional fields with defaults (e.g. compose `entries`, `showIf`) may be left out. */
export type AppSpecDraft = z.input<typeof AppSpecDraftSchema>;

/** Stored/runtime shape: presets already expanded. */
export const RuntimeAppSpecSchema = z.object({ ...specFields, blocks: z.array(BlockSchema).min(1).max(MAX_BLOCKS) }).superRefine((spec, ctx) => {
  // Answers, runtime state and results are keyed by block id.
  const seen = new Set<string>();
  spec.blocks.forEach((b, i) => {
    if (seen.has(b.id)) ctx.addIssue({ code: "custom", path: ["blocks", i, "id"], message: `duplicate block id "${b.id}"` });
    seen.add(b.id);
  });
});

/**
 * Parses a draft (presets allowed) and returns the runtime spec. Use this at every trust boundary.
 * Presets are expanded, a block that lists people by name (roster, wheel of participants) forces requireName, and the result is
 * validated again as a runtime spec.
 */
export const AppSpecSchema = AppSpecDraftSchema.transform((draft, ctx) => {
  const blocks = draft.blocks.map(expandDraftBlock);
  const requireName = draft.requireName || blocks.some((b) => (b.type === "compose" && needsRoster(b)) || (b.type === "wheel" && b.source === "participants"));
  const runtime = RuntimeAppSpecSchema.safeParse({ ...draft, requireName, blocks });
  if (!runtime.success) {
    for (const issue of runtime.error.issues) ctx.addIssue({ code: "custom", path: issue.path, message: issue.message });
    return z.NEVER;
  }
  return runtime.data;
});

export type AppSpec = z.infer<typeof RuntimeAppSpecSchema>;
export type Locale = AppSpec["locale"];
export type ThemeName = AppSpec["theme"];
