// Converts between the flat wire block (what the model emits) and real AppSpec blocks, delegating
// each brick's mapping to its registry definition. `flatSpecToAppSpec` runs after every model call;
// `appSpecToFlatSpec` derives few-shot examples/tests from real specs so the two never drift.
import type { AppSpecDraft, DraftBlock } from "@/engine/app-spec/app-spec-schema";
import { isVocabularyType, vocabularyEntry } from "@/engine/blocks/block-vocabulary";
import { FLAT_FIELD_NAMES } from "@/engine/blocks/block-llm-fields";
import type { FlatAppSpec, FlatBlock } from "./llm-output-wire-schema";

/**
 * A block the model left untitled takes the app's title (small models often leave it empty when
 * the app has one block) — a harmless gap, filled here instead of spending a repair call on it.
 */
const withTitle = (appTitle: string) => (b: FlatBlock): FlatBlock =>
  "title" in b && (typeof b.title !== "string" || !b.title.trim()) && appTitle.trim() ? { ...b, title: appTitle } : b;

/** Candidate object — NOT validated. Callers must run it through AppSpecSchema.safeParse. */
export function flatSpecToAppSpec(flat: FlatAppSpec): AppSpecDraft {
  return {
    specVersion: flat.specVersion,
    locale: flat.locale,
    title: flat.title,
    description: flat.description,
    theme: flat.theme,
    requireName: flat.requireName,
    // null/missing → left out, so AppSpecSchema's default ("stack") applies
    layout: flat.layout ?? undefined,
    // Unknown block types are passed through untouched so AppSpecSchema reports them (→ repair).
    blocks: flat.blocks.map(withTitle(flat.title)).map((b) => (isVocabularyType(b.type) ? vocabularyEntry(b.type).fromFlat(b) : (b as unknown as DraftBlock))),
  };
}

/** Inverse of the above: any draft or runtime spec is representable as a flat wire spec. */
export function appSpecToFlatSpec(spec: AppSpecDraft): FlatAppSpec {
  return {
    specVersion: spec.specVersion,
    locale: spec.locale,
    title: spec.title,
    description: spec.description,
    theme: spec.theme,
    requireName: spec.requireName,
    layout: spec.layout ?? null,
    blocks: spec.blocks.map(blockToFlatBlock),
  };
}

function blockToFlatBlock(block: AppSpecDraft["blocks"][number]): FlatBlock {
  const empty = Object.fromEntries(FLAT_FIELD_NAMES.map((name) => [name, null]));
  // Drafts may omit defaulted fields; each toFlat fills them in.
  return { ...empty, ...vocabularyEntry(block.type).toFlat(block as DraftBlock), type: block.type, id: block.id };
}
