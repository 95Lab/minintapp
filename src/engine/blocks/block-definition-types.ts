// The contract every brick ("block") implements. Everything block-specific lives in one
// definition: spec + answer schemas, the AI-facing fields, validation, results, security text,
// host actions, sample answers and prompt docs. Routes, the generation pipeline, the security scan
// and the UI all dispatch through block-registry.ts, so adding a brick never touches them.
// Guide: docs/blocks-and-templates.md
import type { ErrorCode } from "@/engine/api/app-error-codes";
import type { Locale } from "@/engine/app-spec/app-spec-schema";
import type { z } from "zod";
import type { JsonSchema } from "./block-schema-primitives";

/** App-wide runtime state. Quiz keeps its top-level fields; other bricks use `blocks[blockId]`. */
export interface AppRuntime {
  openQuestionId: string | null;
  revealedQuestionIds: string[];
  blocks?: Record<string, unknown>;
}

export interface AnswerRow<P> {
  blockId: string;
  itemId: string;
  participantHash: string;
  displayName: string | null;
  payload: P;
  createdAt: number;
}

export interface ResultsContext {
  appStatus: "active" | "closed" | "ended" | "blocked";
  runtime: AppRuntime;
  viewer: { isHost: boolean; participantHash: string | null };
  /** The app's language, for the few words results carry (anonymous name, waitlist mark). Default "vi". */
  locale?: Locale;
  /** Signed URL of an uploaded photo (server only: the signing key never reaches a browser). */
  photoUrl?: (photoId: string) => string;
  /** What this block's `prefetch` returned for this request (absent when it has none or it failed). */
  prefetched?: unknown;
}

export type AnswerValidationError = "bad_payload" | "question_closed" | "too_long";

/** One AI-facing field of the flat block (nullable). Shared names across bricks must be identical. */
export interface LlmField {
  json: JsonSchema;
  wire: z.ZodTypeAny;
}

/** `error` is an API error code (app-error-codes.ts): the client words it in the app's language. */
export type HostActionResult = { ok: true; runtime: AppRuntime } | { ok: false; error: ErrorCode };

export interface HostActionContext<P> {
  args: Record<string, unknown>;
  /** Cryptographically strong uniform [0,1) on the server. */
  random: () => number;
  /** This block's answers (e.g. wheel entrants). */
  answers: AnswerRow<P>[];
}

/** Reads a brick's own runtime slot. */
export function blockState<T>(runtime: AppRuntime, blockId: string, fallback: T): T {
  return (runtime.blocks?.[blockId] as T | undefined) ?? fallback;
}

/** Returns a new runtime with this brick's slot replaced. */
export function withBlockState(runtime: AppRuntime, blockId: string, state: unknown): AppRuntime {
  return { ...runtime, blocks: { ...(runtime.blocks ?? {}), [blockId]: state } };
}

export interface BlockDefinition<B extends { type: string; id: string }, P extends { kind: string }, R> {
  type: B["type"];
  /** Shown in docs / template gallery. */
  label: { vi: string; en: string };
  /** One entry of the "available bricks" list in the system prompt (VN/EN). */
  promptDoc: string;
  /** Extra intent→field mapping rules for the system prompt. */
  promptRules?: string;

  specSchema: z.ZodType<B>;
  /** Answer payload; `kind` must equal the block type. */
  payloadSchema: z.ZodType<P>;

  llmFields: Record<string, LlmField>;
  fromFlat(flat: Record<string, unknown> & { id: string }): B;
  toFlat(block: B): Record<string, unknown>;

  validate(block: B, payload: P, ctx: { itemId: string; runtime: AppRuntime }): AnswerValidationError | null;
  /**
   * Async data the (sync) computeResults needs, e.g. live weather. Awaited once per state build and
   * handed to computeResults as `ctx.prefetched`. Must not throw for upstream failures: return null.
   */
  prefetch?(block: B): Promise<unknown>;
  computeResults(block: B, rows: AnswerRow<P>[], ctx: ResultsContext): R | null;
  summarizeForRemix(block: B, results: R | null): string;

  /** Text for the phishing scan. inputLabels: labels of things participants TYPE into. */
  security: {
    inputLabels(block: B): string[];
    /** Texts where "enter your OTP"-style wording is blocking (instructions/questions). */
    instructionTexts(block: B): string[];
    allTexts(block: B): string[];
  };

  /** Hide secrets (e.g. quiz answers) from participants. Default: block unchanged. */
  stripPrivate?(block: B, revealedQuestionIds: ReadonlySet<string>): unknown;
  /** Host-only actions (quiz open/reveal, wheel spin…). `args` is validated by the action itself. */
  hostActions?: Record<string, (block: B, runtime: AppRuntime, ctx: HostActionContext<P>) => HostActionResult>;
  /** Preview-only sample answer for "add sample participants". */
  sampleAnswer?(block: B, runtime: AppRuntime, random: () => number): { itemId: string; payload: P } | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyBlockDefinition = BlockDefinition<any, any, any>;
