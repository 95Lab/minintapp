// Provider-neutral generation pipeline used by generateAppSpec and remixAppSpec: call the active
// LLM provider with the LlmOutput JSON schema, parse + convert the flat wire shape to AppSpec,
// validate with AppSpecSchema, and retry once (repair, quoting the zod error) if enough of the
// shared 18s deadline remains. Never throws: provider errors, safety blocks and exhausted repairs
// all resolve to a friendly LlmOutput, per the frozen generateAppSpec/remixAppSpec contract.
import { createHash } from "node:crypto";
import { z } from "zod";
import { AppSpecSchema, type Locale } from "@/engine/app-spec/app-spec-schema";
import type { GenerationMeta, LlmOutput } from "./llm-output-types";
import { createDeadlineTracker, REPAIR_MIN_REMAINING_MS } from "./generation-deadline";
import { flatSpecToAppSpec } from "./llm-flat-spec-conversion";
import { fillOmittedNulls } from "./fill-omitted-nulls";
import { repairHarmlessSlips } from "./harmless-output-repairs";
import { LLM_OUTPUT_JSON_SCHEMA } from "./llm-output-json-schema";
import { llmOutputWireSchema } from "./llm-output-wire-schema";
import { GENERATION_SYSTEM_PROMPT } from "./system-prompt-vi-en";
import { LlmCallError, type LlmProvider } from "./providers/llm-provider-types";

const FRIENDLY_MESSAGES = {
  vi: {
    timeout: "Xin lỗi, tạo app mất quá lâu. Thử mô tả ngắn gọn hơn hoặc thử lại sau.",
    error: "Không tạo được app lúc này. Thử lại sau ít phút, hoặc mô tả ngắn gọn hơn.",
    invalid: "Chưa tạo được app hợp lệ từ mô tả này. Thử mô tả cụ thể hơn (loại app, câu hỏi/lựa chọn).",
    blocked: "Yêu cầu này bị bộ lọc an toàn từ chối. Thử mô tả khác.",
  },
  en: {
    timeout: "Sorry, generation took too long. Try a shorter description or try again.",
    error: "Couldn't generate an app right now. Try again in a bit, or shorten the description.",
    invalid: "Couldn't turn this into a valid app yet. Try describing it more concretely (app type, questions/options).",
    blocked: "This request was refused by the safety filter. Try a different description.",
  },
} as const;

type FriendlyKind = keyof (typeof FRIENDLY_MESSAGES)["vi"];

function friendlyOutput(locale: Locale, kind: FriendlyKind): LlmOutput {
  const outcome = kind === "blocked" ? "refused" : "unsupported";
  return { outcome, spec: null, suggestion: FRIENDLY_MESSAGES[locale][kind], riskFlags: ["none"] };
}

type AttemptResult = ({ kind: "final"; output: LlmOutput } | { kind: "invalid"; reason: string }) & { outputChars?: number; raw?: string };

/**
 * One model call → parsed + validated LlmOutput, or a reason to repair. Never throws.
 * `enforceLocale`: an app in the other language than the prompt (small local models do this) is sent back for repair.
 */
async function attemptOnce(provider: LlmProvider, instructions: string, input: string, signal: AbortSignal, locale: Locale, enforceLocale = false): Promise<AttemptResult> {
  let raw: unknown;
  try {
    raw = await provider.callStructured({ instructions, input, jsonSchema: LLM_OUTPUT_JSON_SCHEMA, schemaName: "minint_app", signal });
  } catch (err) {
    const kind = err instanceof LlmCallError ? err.kind : "network";
    if (kind === "invalid_json") {
      // A provider that checks the schema itself (Groq) says where the answer went wrong: pass that on to the repair.
      const detail = err instanceof LlmCallError && err.cause instanceof Error ? /jsonschema:.*/.exec(err.cause.message)?.[0] : undefined;
      return { kind: "invalid", reason: detail ? `output did not match the JSON schema: ${detail.slice(0, 400)}` : "output was not valid JSON" };
    }
    if (kind === "blocked") return { kind: "final", output: friendlyOutput(locale, "blocked") };
    return { kind: "final", output: friendlyOutput(locale, kind === "aborted" ? "timeout" : "error") };
  }

  const text = JSON.stringify(raw ?? null);
  return { ...interpret(raw, locale, enforceLocale), outputChars: text.length, raw: text };
}

/** New apps: one line naming the user's language, so models whose examples are mostly Vietnamese don't drift. */
function withLanguageHint(input: string, locale: Locale): string {
  return `${input}\n\n${locale === "en" ? 'Language: English — write the whole app in English (locale "en").' : 'Ngôn ngữ: tiếng Việt — viết toàn bộ app bằng tiếng Việt (locale "vi").'}`;
}

function interpret(raw: unknown, locale: Locale, enforceLocale: boolean): AttemptResult {
  // Fields the model left out instead of writing null count as null.
  const wire = llmOutputWireSchema.safeParse(repairHarmlessSlips(fillOmittedNulls(raw, LLM_OUTPUT_JSON_SCHEMA)));
  if (!wire.success) return { kind: "invalid", reason: `wire shape mismatch: ${z.prettifyError(wire.error)}` };

  if (wire.data.outcome !== "ok") {
    const riskFlags = wire.data.riskFlags.length ? wire.data.riskFlags : (["none"] as const);
    return { kind: "final", output: { outcome: wire.data.outcome, spec: null, suggestion: wire.data.suggestion, riskFlags: [...riskFlags] } };
  }
  if (!wire.data.spec) return { kind: "invalid", reason: "outcome was \"ok\" but spec was null" };

  const parsed = AppSpecSchema.safeParse(flatSpecToAppSpec(wire.data.spec));
  if (!parsed.success) return { kind: "invalid", reason: z.prettifyError(parsed.error) };
  if (enforceLocale && parsed.data.locale !== locale) {
    const language = locale === "vi" ? "tiếng Việt" : "English";
    return { kind: "invalid", reason: `locale phải là "${locale}" vì người dùng viết bằng ${language}: viết MỌI chữ trong app (title, câu hỏi, lựa chọn…) bằng ${language}.` };
  }

  const riskFlags = wire.data.riskFlags.length ? wire.data.riskFlags : (["none"] as const);
  return { kind: "final", output: { outcome: "ok", spec: parsed.data, suggestion: null, riskFlags: [...riskFlags] } };
}

function buildRepairInput(originalInput: string, reason: string): string {
  return `${originalInput}\n\nKết quả trước không hợp lệ theo schema/zod: ${reason}\nHãy sửa lại và trả đúng JSON theo schema, không giải thích thêm.`;
}

export interface RunGenerationOptions {
  signal: AbortSignal;
  locale: Locale;
  /** Appended to the base system prompt, e.g. REMIX_INSTRUCTIONS_ADDENDUM. */
  instructionsAddendum?: string;
  /** New apps: the app must be written in the prompt's language (checked on the first attempt only). */
  enforceLocale?: boolean;
}

/** Hash of everything that shapes the model's answer besides the user's words. */
export function generationFingerprint(provider: Pick<LlmProvider, "id" | "model">, instructions: string): string {
  return createHash("sha256")
    .update([instructions, JSON.stringify(LLM_OUTPUT_JSON_SCHEMA), provider.id, provider.model()].join("\u0000"))
    .digest("hex")
    .slice(0, 12);
}

/** Core engine behind generateAppSpec/remixAppSpec for any configured provider. */
export async function runLlmGeneration(provider: LlmProvider, input: string, opts: RunGenerationOptions): Promise<LlmOutput> {
  const instructions = opts.instructionsAddendum ? `${GENERATION_SYSTEM_PROMPT}\n\n${opts.instructionsAddendum}` : GENERATION_SYSTEM_PROMPT;
  const deadline = createDeadlineTracker();
  const meta = (attempts: number, last: AttemptResult | null): GenerationMeta => ({
    provider: provider.id,
    model: provider.model(),
    fingerprint: generationFingerprint(provider, instructions),
    attempts,
    outputChars: last?.outputChars ?? null,
  });
  const done = (output: LlmOutput, attempts: number, last: AttemptResult | null): LlmOutput => ({ ...output, generation: meta(attempts, last) });

  const prompt = opts.enforceLocale ? withLanguageHint(input, opts.locale) : input;
  const first = await attemptOnce(provider, instructions, prompt, opts.signal, opts.locale, opts.enforceLocale);
  if (first.kind === "final") return done(first.output, 1, first);

  if (opts.signal.aborted) return done(friendlyOutput(opts.locale, "timeout"), 1, first);
  if (deadline.remainingMs() < REPAIR_MIN_REMAINING_MS) return done(friendlyOutput(opts.locale, "invalid"), 1, first);

  // Why the model's answer was sent back: the first thing to read when an app type keeps failing.
  console.warn("[generate] repairing invalid structured output");
  const second = await attemptOnce(provider, instructions, buildRepairInput(prompt, first.reason), opts.signal, opts.locale);
  // The model's own answer (trimmed): shows what it misunderstood when even the repair fails.
  if (second.kind === "invalid") console.warn("[generate] repair failed validation");
  return done(second.kind === "final" ? second.output : friendlyOutput(opts.locale, "invalid"), 2, second);
}
