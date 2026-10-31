"use client";
import { useRuntimeTranslation } from "@/lib/i18n/runtime-locale";

import { PromptComposer } from "./prompt-composer";
import { TemplateGallery, type TemplateCard } from "./template-gallery";
import type { GenerateRequest } from "@/lib/api/api-contract-types";
export function HomeScreen({ templates = [], onGenerate, onSelectTemplate }: { templates?: TemplateCard[]; onGenerate?: (request: GenerateRequest) => Promise<void>; onSelectTemplate?: (id: string) => void }) {
  const tr = useRuntimeTranslation();
  return <div className="mini-app"><h1>{tr("Tạo mini-app cho nhu cầu của bạn")}</h1><PromptComposer onGenerate={onGenerate} /><TemplateGallery templates={templates} onSelect={onSelectTemplate} /></div>;
}
