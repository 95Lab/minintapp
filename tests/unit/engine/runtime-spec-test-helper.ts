// Test helper: authored specs (examples, hand-written drafts) may use presets; everything that runs
// (repository, scan, results) takes the runtime spec that AppSpecSchema produces at the trust boundary.
import { AppSpecSchema, type AppSpec, type AppSpecDraft } from "@/engine/app-spec/app-spec-schema";

export const runtimeSpec = (draft: AppSpecDraft): AppSpec => AppSpecSchema.parse(draft);
