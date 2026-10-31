import { composeSpec } from "@/lib/app-spec/app-spec-examples";
import type { Locale } from "@/lib/app-spec/app-spec-schema";
import { AppError } from "@/lib/api/app-error-codes";
export const POLL_TEMPLATE_ID = "poll-drinks";
export function templateSpec(templateId: string, locale: Locale) {
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
