// Contract every LLM provider adapter implements. The generation pipeline (prompting, schema
// validation, repair, deadline, fallbacks) is provider-neutral and only talks to this interface,
// Internal contract for the OpenAI structured-output adapter.
// See docs/llm-providers.md for the step-by-step guide.

export type JsonSchema = Record<string, unknown>;

/** Normalized failure kinds; adapters must map every SDK error onto one of these. */
export type LlmCallErrorKind =
  | "aborted" // deadline or client disconnect
  | "network" // transport/API/auth/quota errors
  | "incomplete" // output cut off (token cap)
  | "empty_output"
  | "invalid_json"
  | "blocked"; // provider-side safety filter refused the request/response

export class LlmCallError extends Error {
  constructor(
    readonly kind: LlmCallErrorKind,
    readonly cause?: unknown,
  ) {
    super(kind);
    this.name = "LlmCallError";
  }
}

export interface StructuredCallRequest {
  /** System prompt (rules + few-shot). */
  instructions: string;
  /** User turn (prompt, or remix input). */
  input: string;
  /** Provider-neutral JSON Schema of the expected output; adapters may translate it. */
  jsonSchema: JsonSchema;
  schemaName: string;
  signal: AbortSignal;
}

export interface ModerationResult {
  ok: boolean;
  reason?: string;
}

export interface LlmProvider {
  /** Stable id used in LLM_PROVIDER, /api/health and logs, e.g. "openai", "gemini". */
  readonly id: string;
  /** Human label for the status badge, e.g. "Codex (OpenAI)". */
  readonly label: string;
  /** True when the provider has what it needs (API key…) to be used. */
  isConfigured(): boolean;
  /** Model name in use (from env or the adapter default). */
  model(): string;
  /** One structured-output call. Returns parsed JSON; throws LlmCallError on any failure. */
  callStructured(req: StructuredCallRequest): Promise<unknown>;
  /** Optional input moderation. Providers without a moderation endpoint omit it. */
  moderate?(text: string): Promise<ModerationResult>;
}
