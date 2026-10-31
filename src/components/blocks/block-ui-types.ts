import type { PublicAppSpec } from "@/lib/app-spec/strip-private-fields";
import type { AppRuntime } from "@/lib/blocks/block-definition-types";
import type { ResponsePayload } from "@/lib/blocks/block-registry";
export type PublicBlock = PublicAppSpec["blocks"][number];
export type PublicBlockOf<T extends PublicBlock["type"]> = Extract<PublicBlock, { type: T }>;
export interface ParticipantBlockProps<B = PublicBlock> {
  block: B; result?: import("@/lib/responses/compute-results").BlockResults; runtime: AppRuntime; open: boolean; displayName?: string;
  myAnswers?: Record<string, ResponsePayload>;
  onSubmit?: (itemId: string, payload: ResponsePayload) => Promise<boolean>;
}
export interface HostBlockProps<B = PublicBlock> {
  block: B; result?: import("@/lib/responses/compute-results").BlockResults; runtime: AppRuntime; busy?: boolean; canControl: boolean;
  onAction?: (action: string, args?: Record<string, string | number | boolean>) => Promise<void>;
}
export interface DataRow { id: string; label: string; value?: string | number }
export interface RowsViewProps { title?: string; rows: readonly DataRow[] }
