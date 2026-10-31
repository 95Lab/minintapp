"use client";
import { RuntimeLocaleProvider, useRuntimeTranslation } from "@/lib/i18n/runtime-locale";
import type { AppRendererParticipantProps } from "./app-renderer-participant";
import { HostBlock } from "./blocks/block-ui-registry";
export interface AppRendererHostProps extends Pick<AppRendererParticipantProps, "spec" | "runtime"> {
  blockResults?: import("@/lib/responses/compute-results").BlockResults[];
  canControl: boolean; busy?: boolean;
  onAction?: (blockId: string, action: string, args?: Record<string, string | number | boolean>) => Promise<void>;
  results?: React.ReactNode;
}
// Presentation only: authorization must also be enforced by the server.
export function AppRendererHost({ spec, runtime, canControl, busy, onAction, results, blockResults }: AppRendererHostProps) {
  const tr = useRuntimeTranslation(spec.locale);
  return <RuntimeLocaleProvider locale={spec.locale}><div lang={spec.locale} className="mini-app"><h1>Host · {spec.title}</h1>{spec.blocks.map((block) => <HostBlock key={block.id} block={block} result={blockResults?.find((r) => r.blockId === block.id)} runtime={runtime} canControl={canControl} busy={busy} onAction={onAction ? (action, args) => onAction(block.id, action, args) : undefined} />)}{results ?? <p>{tr("Chưa có dữ liệu kết quả từ server.")}</p>}</div></RuntimeLocaleProvider>;
}
