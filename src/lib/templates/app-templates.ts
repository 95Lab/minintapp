import { composeTemplate } from "./compose-templates";
import { AppSpecSchema } from "@/lib/app-spec/app-spec-schema";
import { composeSpec, quizSpec } from "@/lib/app-spec/app-spec-examples";
import type { Locale } from "@/lib/app-spec/app-spec-schema";
import { AppError } from "@/lib/api/app-error-codes";
export const POLL_TEMPLATE_ID = "poll-drinks";
export function templateSpec(templateId: string, locale: Locale) {
  const compose = composeTemplate(templateId, locale);
  if (compose) return compose;
  if (templateId === "quiz-general") {
    const spec = quizSpec(); spec.locale = locale; spec.requireName = true;
    const block = spec.blocks[0];
    if (block.type === "quiz") {
      if (locale === "en") { spec.title = "Sample quiz"; block.questions[0].prompt = "What is one plus one?"; block.questions[0].options = [{ id: "a", label: "Two" }, { id: "b", label: "Three" }]; }
      block.questions.push({ id: "q2", prompt: locale === "vi" ? "Thủ đô của Việt Nam là?" : "What is the capital of Vietnam?", options: [{ id: "a", label: "Hà Nội" }, { id: "b", label: "TP. Hồ Chí Minh" }], correct: "a", points: 100, timeLimitSec: 20 });
    }
    return spec;
  }
  if (templateId === "wheel-participants" || templateId === "wheel-options") {
    const participants = templateId === "wheel-participants";
    return AppSpecSchema.parse({ specVersion: 1, locale, title: locale === "vi" ? "Bốc thăm" : "Lucky draw", description: null, theme: "forest", requireName: participants, layout: "stack", blocks: [{ type: "wheel", id: "wheel", title: locale === "vi" ? "Vòng quay may mắn" : "Lucky wheel", source: participants ? "participants" : "options", removeWinner: true, options: participants ? [] : [{ id: "tea", label: locale === "vi" ? "Trà" : "Tea" }, { id: "coffee", label: locale === "vi" ? "Cà phê" : "Coffee" }, { id: "water", label: locale === "vi" ? "Nước" : "Water" }] }] });
  }
  if (templateId !== POLL_TEMPLATE_ID) throw new AppError("not_found");
  const spec = composeSpec();
  spec.locale = locale;
  if (locale === "en") {
    spec.title = "Poll";
    const block = spec.blocks[0];
    if (block.type === "compose") {
      block.title = "Choose a drink";
      block.inputs[0].label = "Drink";
      block.inputs[0].options![0].label = "Tea";
      block.inputs[0].options![1].label = "Coffee";
    }
  }
  return spec;
}
