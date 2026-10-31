"use client";
import { PromptComposer } from "./prompt-composer";
import { TemplateGallery, type TemplateCard } from "./template-gallery";
import type { GenerateRequest } from "@/lib/api/api-contract-types";
export function HomeScreen({ templates = [], onGenerate, onSelectTemplate }: { templates?: TemplateCard[]; onGenerate?: (request: GenerateRequest) => Promise<void>; onSelectTemplate?: (id: string) => void }) {
  return <div className="mini-app"><h1>Tạo mini-app cho nhu cầu của bạn</h1><PromptComposer onGenerate={onGenerate} /><TemplateGallery templates={templates} onSelect={onSelectTemplate} /></div>;
}
