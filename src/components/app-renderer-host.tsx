"use client";
import type { AppRendererParticipantProps } from "./app-renderer-participant";
import { HostBlock } from "./blocks/block-ui-registry";
export interface AppRendererHostProps extends Pick<AppRendererParticipantProps, "spec" | "runtime"> {
  canControl: boolean; busy?: boolean;
  onAction?: (blockId: string, action: string, args?: Record<string, string | number | boolean>) => Promise<void>;
  results?: React.ReactNode;
}
// Presentation only: authorization must also be enforced by the server.
export function AppRendererHost({ spec, runtime, canControl, busy, onAction, results }: AppRendererHostProps) {
  return <div className="mini-app"><h1>Host · {spec.title}</h1>{spec.blocks.map((block) => <HostBlock key={block.id} block={block} runtime={runtime} canControl={canControl} busy={busy} onAction={onAction ? (action, args) => onAction(block.id, action, args) : undefined} />)}{results ?? <p>Chưa có dữ liệu kết quả từ server.</p>}</div>;
}
