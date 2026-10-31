// Output contract of every generator (Codex/OpenAI or the keyword mock).
import type { AppSpec } from "@/engine/app-spec/app-spec-schema";

export type RiskFlag = "credential_request" | "payment_request" | "impersonation" | "external_link" | "none";

export interface LlmOutput {
  outcome: "ok" | "unsupported" | "refused";
  spec: AppSpec | null;
  suggestion: string | null;
  riskFlags: RiskFlag[];
  /** How this output was produced (eval, logs, debugging a bad app). Absent for the keyword mock. */
  generation?: GenerationMeta;
}

export interface GenerationMeta {
  provider: string;
  model: string;
  /** Short hash of system prompt + JSON schema + provider + model: which "version" of generation made this. */
  fingerprint: string;
  /** 1, or 2 when the first answer was sent back for repair. */
  attempts: number;
  /** Characters of the model's JSON output on the last attempt (output size, ~tokens × 3–4). */
  outputChars: number | null;
}
