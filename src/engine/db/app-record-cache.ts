// Short-lived cache of app records for the hot read path (GET /state polling from a room of phones).
// Every write through the repository in THIS process drops the entry, so the writer's next read is
// fresh; other processes may serve an entry up to TTL_MS old. Refetches triggered by a realtime signal
// ask for a fresh read (see route-helpers resolveUsableApp), so a host action is never hidden behind
// a stale 304 — only plain polls, which are best-effort anyway, use the cache.
import type { AppRecord, AppsRepository } from "./apps-repository-types";

const TTL_MS = 300;
const MAX_ENTRIES = 500;

type Entry = { at: number; record: Promise<AppRecord | null> };
const cache = ((globalThis as Record<string, unknown>).__minintAppRecordCache ??= new Map<string, Entry>()) as Map<string, Entry>;

export function forgetApp(appId: string): void {
  cache.delete(appId);
}

/** Reads through the cache (single-flight within TTL). */
export function findAppCached(repo: AppsRepository, appId: string): Promise<AppRecord | null> {
  const hit = cache.get(appId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.record;
  const record = repo.findApp(appId);
  cache.set(appId, { at: Date.now(), record });
  record.catch(() => cache.delete(appId));
  while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
  return record;
}

/** Wraps a repository so every write invalidates the cached record of the app it touched. */
export function invalidatingRepository(repo: AppsRepository): AppsRepository {
  const after = <T,>(appId: string, p: Promise<T>) => p.finally(() => forgetApp(appId));
  return {
    ...repo,
    submitResponse: (appId, r, opts) => after(appId, repo.submitResponse(appId, r, opts)),
    patchRuntime: (appId, patch) => after(appId, repo.patchRuntime(appId, patch)),
    updateApp: (appId, patch) => after(appId, repo.updateApp(appId, patch)),
    markMoved: (appId, toId) => after(appId, repo.markMoved(appId, toId)),
    endApp: (appId) => after(appId, repo.endApp(appId)),
    setOwner: (appId, userId) => after(appId, repo.setOwner(appId, userId)),
    setAnnouncement: (appId, value) => after(appId, repo.setAnnouncement(appId, value)),
    setPayee: (appId, value) => after(appId, repo.setPayee(appId, value)),
    extendApp: (appId, until) => after(appId, repo.extendApp(appId, until)),
    addReport: (appId, reporter, ip, threshold) => after(appId, repo.addReport(appId, reporter, ip, threshold)),
  };
}
