"use client";
// UI side of the brick registry: runtime block type → { Host, Participant } components with a common
// props contract (block-ui-types.ts). Presets (poll, group order, word cloud) render through compose.
// The mapped type fails the build if a registered brick has no UI.
import type { ComponentType } from "react";
import type { BlockResults } from "@/engine/api/api-contract-types";
import type { BlockType } from "@/engine/app-spec/app-spec-schema";
import type { PublicBlock } from "@/engine/app-spec/strip-private-fields";
import type { HostBlockProps, ParticipantBlockProps } from "./block-ui-types";
import { ComposeBlock, ComposeBlockHost } from "./compose-block";
import { CustomBlock, CustomBlockHost } from "./custom-block";
import { LiveBlock, LiveBlockHost } from "./live-block";
import { QuizBlock } from "./quiz-block";
import { QuizBlockHost } from "./quiz-block-host";
import { WheelBlock, WheelBlockHost } from "./wheel-block";

type BlockOf<K extends BlockType> = Extract<PublicBlock, { type: K }>;
type ResultsOf<K extends BlockType> = Extract<BlockResults, { type: K }>;

interface BlockUi<K extends BlockType> {
  Host: ComponentType<HostBlockProps<BlockOf<K>, ResultsOf<K>>>;
  Participant: ComponentType<ParticipantBlockProps<BlockOf<K>, ResultsOf<K>>>;
}

export const BLOCK_UI: { [K in BlockType]: BlockUi<K> } = {
  compose: { Host: ComposeBlockHost, Participant: ComposeBlock },
  quiz: {
    Host: ({ block, results, runtime, locale, busy, canControl, onAction }) => (
      <QuizBlockHost block={block} results={results} runtime={runtime} locale={locale} busy={busy} canControl={canControl} onAction={(action, questionId) => onAction(action, { questionId })} />
    ),
    Participant: ({ block, runtime, myAnswers, open, locale, onSubmit }) => (
      <QuizBlock block={block} runtime={runtime} myAnswers={myAnswers} open={open} locale={locale} onSubmit={onSubmit} />
    ),
  },
  wheel: { Host: WheelBlockHost, Participant: WheelBlock },
  custom: { Host: CustomBlockHost, Participant: CustomBlock },
  live: { Host: LiveBlockHost, Participant: LiveBlock },
};

/** Type-erased lookup for the renderers (block and results always come from the same app state). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function blockUi(type: BlockType): { Host: ComponentType<HostBlockProps<any, any>>; Participant: ComponentType<ParticipantBlockProps<any, any>> } {
  return BLOCK_UI[type] as never;
}
