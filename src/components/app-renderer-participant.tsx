"use client";
import { RuntimeLocaleProvider, useRuntimeTranslation } from "@/lib/i18n/runtime-locale";
import type { PublicAppSpec } from "@/lib/app-spec/strip-private-fields";
import type { AppRuntime } from "@/lib/blocks/block-definition-types";
import type { ResponsePayload } from "@/lib/blocks/block-registry";
import { ParticipantBlock } from "./blocks/block-ui-registry";
import { AppPagesTabs } from "./app-pages-tabs";
export interface AppRendererParticipantProps {
  spec: PublicAppSpec; runtime: AppRuntime; open: boolean; displayName?: string;
  blockResults?: import("@/lib/responses/compute-results").BlockResults[];
  myAnswers?: Record<string, ResponsePayload>;
  onSubmit?: (blockId: string, itemId: string, payload: ResponsePayload) => Promise<boolean>;
}
export function AppRendererParticipant({ spec, runtime, open, displayName = "", myAnswers, onSubmit, blockResults }: AppRendererParticipantProps) {
  const tr = useRuntimeTranslation(spec.locale);
  const needsName = spec.requireName && !displayName.trim();
  const pages = spec.blocks.map((block) => ({ id: block.id, label: "title" in block ? block.title : "Quiz", content: <ParticipantBlock key={block.id} block={block} displayName={displayName} result={blockResults?.find((r) => r.blockId === block.id)} runtime={runtime} open={open && !needsName} myAnswers={myAnswers} onSubmit={onSubmit ? (itemId, payload) => onSubmit(block.id, itemId, payload) : undefined} /> }));
  return <RuntimeLocaleProvider locale={spec.locale}><div lang={spec.locale} className="mini-app" data-app-theme={spec.theme}><header><h1>{spec.title}</h1>{spec.description && <p>{spec.description}</p>}</header>{!open && <p role="status">{tr("Ứng dụng hiện không nhận câu trả lời.")}</p>}{needsName && <p role="status">{tr("Bạn cần nhập tên trước khi tham gia.")}</p>}{spec.layout === "tabs" ? <AppPagesTabs pages={pages} /> : pages.map((p) => <div key={p.id}>{p.content}</div>)}</div></RuntimeLocaleProvider>;
}
