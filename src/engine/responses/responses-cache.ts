// Answers read once per (app, state_version), shared by every request for that version. Every
// write bumps state_version, so a cached entry is never stale for its version; concurrent requests
// for the same version wait on the same read (single-flight) instead of each hitting the database.
// Per-process: with several server instances each keeps its own — still correct, just less shared.
import type { ResponseRecord } from "@/engine/db/apps-repository-types";

const MAX_ENTRIES = 300;
const VERSIONS_PER_APP = 2;

const cache = ((globalThis as Record<string, unknown>).__minintResponsesCache ??= new Map<string, Promise<ResponseRecord[]>>()) as Map<string, Promise<ResponseRecord[]>>;

export async function responsesForVersion(appId: string, version: number, load: () => Promise<ResponseRecord[]>): Promise<{ rows: ResponseRecord[]; hit: boolean }> {
  const key = `${appId}:${version}`;
  const existing = cache.get(key);
  if (existing) return { rows: await existing, hit: true };

  const pending = load();
  cache.set(key, pending);
  pending.catch(() => cache.delete(key)); // a failed read must not be served to the next request
  // Keep only the newest versions of this app, and a bounded total (insertion order ≈ age).
  const ofApp = [...cache.keys()].filter((k) => k.startsWith(`${appId}:`));
  for (const old of ofApp.slice(0, Math.max(0, ofApp.length - VERSIONS_PER_APP))) cache.delete(old);
  while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
  return { rows: await pending, hit: false };
}

/** Tests / app end: drop everything cached for an app. */
export function forgetResponses(appId: string): void {
  for (const k of [...cache.keys()]) if (k.startsWith(`${appId}:`)) cache.delete(k);
}
