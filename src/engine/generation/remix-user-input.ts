// Builds the `input` text for a remix call: current spec (JSON) + resultsSummary + instruction.
// Kept as plain labelled text (not a custom object schema) since the Responses API `input` field
// only takes a string or ResponseInput items — a clearly labelled string is simplest and the
// system prompt's REMIX_INSTRUCTIONS_ADDENDUM tells the model how to read it.
import type { AppSpec } from "@/engine/app-spec/app-spec-schema";
import { withoutNulls } from "./json-without-nulls";

export function buildRemixUserInput(spec: AppSpec, resultsSummary: string, instruction: string): string {
  return [
    // Null fields left out (the model fills them back from the schema): keeps remix inside per-minute token quotas.
    `AppSpec hiện tại (JSON, bỏ các trường null): ${JSON.stringify(withoutNulls(spec))}`,
    `resultsSummary: ${resultsSummary || "(chưa có kết quả)"}`,
    `Yêu cầu chỉnh sửa: ${instruction}`,
  ].join("\n");
}
