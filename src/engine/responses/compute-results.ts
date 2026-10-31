// Server-side aggregation, dispatched per brick through the registry. Clients only ever see these
// aggregates (never raw tokens); scores / totals / draws are computed here so a client can't fake them.
import type { AppSpec } from "@/engine/app-spec/app-spec-schema";
import type { BlockResults, ResponsePayload } from "@/engine/api/api-contract-types";
import type { AppRecord, ResponseRecord } from "@/engine/db/apps-repository-types";
import { blockDefinition } from "@/engine/blocks/block-registry";
import { photoUrl } from "@/engine/security/photo-url-signing";

export interface Viewer {
  isHost: boolean;
  participantHash: string | null;
}

/** Async data some bricks need for their (sync) results, keyed by block id. A failing prefetch just leaves its block without data. */
export async function prefetchBlocks(spec: AppSpec): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  await Promise.all(
    spec.blocks.map(async (block) => {
      const prefetch = blockDefinition(block.type).prefetch;
      if (!prefetch) return;
      try {
        out[block.id] = await prefetch(block);
      } catch (err) {
        console.error(`[results] prefetch of ${block.type} "${block.id}" failed`, err);
      }
    }),
  );
  return out;
}

export function computeResults(app: AppRecord, responses: ResponseRecord[], viewer: Viewer, prefetched: Record<string, unknown> = {}): Array<BlockResults | null> {
  return app.spec.blocks.map((block) => {
    const rows = responses.filter((r) => r.blockId === block.id && r.payload.kind === block.type);
    // One broken block shows "no results" instead of failing the whole state request for the room.
    return isolated(`results of ${block.type} "${block.id}"`, null, () => blockDefinition(block.type).computeResults(block, rows, { appStatus: app.status, runtime: app.runtime, viewer, locale: app.spec.locale, prefetched: prefetched[block.id], photoUrl: (photoId: string) => photoUrl(app.id, photoId) }) as BlockResults | null);
  });
}

function isolated<T>(what: string, fallback: T, run: () => T): T {
  try {
    return run();
  } catch (err) {
    console.error(`[results] ${what} failed`, err);
    return fallback;
  }
}

export function myAnswers(responses: ResponseRecord[], participantHash: string | null): Record<string, ResponsePayload> {
  const out: Record<string, ResponsePayload> = {};
  if (!participantHash) return out;
  for (const r of responses) if (r.participantHash === participantHash) out[`${r.blockId}:${r.itemId}`] = r.payload;
  return out;
}

export function participantCount(responses: ResponseRecord[]) {
  return new Set(responses.map((r) => r.participantHash)).size;
}

/** Plain-text summary handed to the generator on remix, e.g. "Bạn muốn nghe…: AI agent 12, Bảo mật 7". */
export function summarizeResultsForRemix(spec: AppSpec, results: Array<BlockResults | null>): string {
  return spec.blocks
    .map((block, i) => isolated(`summary of ${block.type} "${block.id}"`, "", () => blockDefinition(block.type).summarizeForRemix(block, results[i] ?? null)))
    .filter(Boolean)
    .join("\n");
}
