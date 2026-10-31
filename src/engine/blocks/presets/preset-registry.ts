// The presets: shorthand the AI, templates and the keyword mock may write, expanded into compose
// by AppSpecSchema. Adding a preset = one file here + one entry below (the mapped type enforces it).
import { z } from "zod";
import { ChoiceBlockSchema, choicePreset } from "./choice-preset";
import { CollectBlockSchema, collectPreset } from "./collect-preset";
import { OpenTextBlockSchema, openTextPreset } from "./open-text-preset";
import type { PresetDefinition } from "./preset-definition-types";

export const PresetBlockSchema = z.discriminatedUnion("type", [ChoiceBlockSchema, OpenTextBlockSchema, CollectBlockSchema]);
export type PresetBlock = z.infer<typeof PresetBlockSchema>;
export type PresetType = PresetBlock["type"];

export const PRESET_REGISTRY: { [K in PresetType]: PresetDefinition<Extract<PresetBlock, { type: K }>> } = {
  choice: choicePreset,
  collect: collectPreset,
  open_text: openTextPreset,
};

export const PRESET_TYPES = Object.keys(PRESET_REGISTRY) as PresetType[];

export const isPresetType = (type: string): type is PresetType => type in PRESET_REGISTRY;

/** Type-erased lookup (caller passes a block of the matching type). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function presetDefinition(type: PresetType): PresetDefinition<any> {
  return PRESET_REGISTRY[type];
}
