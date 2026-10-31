import type { WheelSpin } from "./wheel/wheel-block";
export interface AppRuntime {
  openQuestionId: string | null;
  revealedQuestionIds: string[];
  blocks: Record<string, { step?: { current: string | null; openedAt: number | null; done: string[] }; spins?: WheelSpin[]; removedEntryIds?: string[] }>;
}
export const initialRuntime = (): AppRuntime => ({ openQuestionId: null, revealedQuestionIds: [], blocks: {} });
