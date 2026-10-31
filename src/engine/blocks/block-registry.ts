// THE list of runtime bricks — what a stored app is made of. Presets (choice, collect, open_text)
// are not here: they are expanded into `compose` before storage (see presets/preset-registry.ts and
// block-vocabulary.ts). Adding a runtime brick = add its folder, then:
//   1. its spec schema to BlockSchema below, 2. its payload schema to ResponsePayloadSchema,
//   3. its definition to BLOCK_REGISTRY, 4. its results type to BlockResults,
//   5. its UI to src/components/blocks/block-ui-registry.tsx.
// The mapped types make TypeScript fail the build if any of these is missing.
import { z } from "zod";
import type { BlockDefinition } from "./block-definition-types";
import { composeBlock, ComposeBlockSchema, ComposePayloadSchema, type ComposeResults } from "./compose/compose-block";
import { customBlock, CustomBlockSchema, CustomPayloadSchema, type CustomResults } from "./custom/custom-block";
import { liveBlock, LiveBlockSchema, LivePayloadSchema, type LiveResults } from "./live/live-block";
import { quizBlock, QuizBlockSchema, QuizPayloadSchema, type QuizResults } from "./quiz/quiz-block";
import { wheelBlock, WheelBlockSchema, WheelPayloadSchema, type WheelResults } from "./wheel/wheel-block";

export const BlockSchema = z.discriminatedUnion("type", [ComposeBlockSchema, QuizBlockSchema, WheelBlockSchema, CustomBlockSchema, LiveBlockSchema]);
export type Block = z.infer<typeof BlockSchema>;
export type BlockType = Block["type"];

export const ResponsePayloadSchema = z.discriminatedUnion("kind", [ComposePayloadSchema, QuizPayloadSchema, WheelPayloadSchema, CustomPayloadSchema, LivePayloadSchema]);
export type ResponsePayload = z.infer<typeof ResponsePayloadSchema>;

export type BlockResults = ComposeResults | QuizResults | WheelResults | CustomResults | LiveResults;

type PayloadOf<K extends BlockType> = Extract<ResponsePayload, { kind: K }>;
type ResultsOf<K extends BlockType> = Extract<BlockResults, { type: K }>;

export const BLOCK_REGISTRY: { [K in BlockType]: BlockDefinition<Extract<Block, { type: K }>, PayloadOf<K>, ResultsOf<K>> } = {
  compose: composeBlock,
  quiz: quizBlock,
  wheel: wheelBlock,
  custom: customBlock,
  live: liveBlock,
};

export const BLOCK_TYPES = Object.keys(BLOCK_REGISTRY) as BlockType[];

/** Type-erased lookup for generic dispatch (callers pass matching block/payload pairs). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function blockDefinition(type: BlockType): BlockDefinition<any, any, any> {
  return BLOCK_REGISTRY[type];
}
