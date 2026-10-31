import type { AppSpec } from "@/lib/app-spec/app-spec-schema";
export interface GenerationMeta { provider: "openai"; model: string; durationMs: number }
export interface GenerationResult { spec: AppSpec; generation: GenerationMeta }
