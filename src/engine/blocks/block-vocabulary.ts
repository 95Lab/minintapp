// Everything a spec *author* (LLM, template, keyword mock, old stored apps) may write: presets first
// (preferred — short and reliable), then runtime bricks. Drafts are expanded into runtime blocks by
// expandDraftBlock, which AppSpecSchema runs before an app is stored.
import { z } from "zod";
import type { LlmField } from "./block-definition-types";
import { BLOCK_REGISTRY, BLOCK_TYPES, type Block, type BlockType } from "./block-registry";
import { ComposeBlockSchema } from "./compose/compose-block";
import { ChoiceBlockSchema } from "./presets/choice-preset";
import { CollectBlockSchema } from "./presets/collect-preset";
import { OpenTextBlockSchema } from "./presets/open-text-preset";
import { isPresetType, PRESET_REGISTRY, PRESET_TYPES, presetDefinition, type PresetBlock, type PresetType } from "./presets/preset-registry";
import { CustomBlockSchema } from "./custom/custom-block";
import { LiveBlockSchema } from "./live/live-block";
import { QuizBlockSchema } from "./quiz/quiz-block";
import { WheelBlockSchema } from "./wheel/wheel-block";

export const DraftBlockSchema = z.discriminatedUnion("type", [
  ChoiceBlockSchema,
  CollectBlockSchema,
  OpenTextBlockSchema,
  ComposeBlockSchema,
  QuizBlockSchema,
  WheelBlockSchema,
  CustomBlockSchema,
  LiveBlockSchema,
]);
export type DraftBlock = z.infer<typeof DraftBlockSchema>;
export type VocabularyType = PresetType | BlockType;

/** Presets first so the model sees them as the default choice. */
export const VOCABULARY_TYPES: VocabularyType[] = [...PRESET_TYPES, ...BLOCK_TYPES];

export interface VocabularyEntry {
  promptDoc: string;
  promptRules?: string;
  llmFields: Record<string, LlmField>;
  fromFlat(flat: Record<string, unknown> & { id: string }): DraftBlock;
  toFlat(block: DraftBlock): Record<string, unknown>;
}

export function vocabularyEntry(type: VocabularyType): VocabularyEntry {
  return (isPresetType(type) ? PRESET_REGISTRY[type] : BLOCK_REGISTRY[type]) as unknown as VocabularyEntry;
}

export const isVocabularyType = (type: string): type is VocabularyType => (VOCABULARY_TYPES as string[]).includes(type);

/** Preset → its compose block; runtime blocks pass through unchanged. */
export function expandDraftBlock(block: DraftBlock): Block {
  return isPresetType(block.type) ? presetDefinition(block.type).expand(block as PresetBlock) : (block as Block);
}

/**
 * Every stored spec goes through here on read, so an app saved by an older version keeps running:
 * - a preset block (apps stored before presets expanded) becomes its compose block;
 * - a runtime block is re-parsed so fields added since then get their defaults; if it no longer
 *   passes today's rules it is kept as stored (it ran when it was saved, and the engine tolerates it);
 * - a block of a type that no longer exists is dropped with a log: nothing could render it, and one
 *   unknown block must not take the rest of the app down.
 */
export function upgradeStoredSpec<S extends { blocks: unknown[] }>(spec: S): Omit<S, "blocks"> & { blocks: Block[] } {
  return { ...spec, blocks: spec.blocks.flatMap(upgradeStoredBlock) };
}

function upgradeStoredBlock(b: unknown): Block[] {
  const head = z.object({ type: z.string(), id: z.string() }).passthrough().safeParse(b);
  if (!head.success) {
    console.warn("[spec] dropping stored block without type/id");
    return [];
  }
  const { type, id } = head.data;
  if (isPresetType(type)) {
    const preset = presetDefinition(type).specSchema.safeParse(b);
    if (preset.success) return [expandDraftBlock(preset.data as DraftBlock)];
    console.warn(`[spec] dropping stored ${type} block "${id}" that no longer parses`);
    return [];
  }
  if (!(BLOCK_TYPES as string[]).includes(type)) {
    console.warn(`[spec] dropping stored block "${id}" of unknown type "${type}"`);
    return [];
  }
  const parsed = BLOCK_REGISTRY[type as BlockType].specSchema.safeParse(b);
  return [(parsed.success ? parsed.data : b) as Block];
}
