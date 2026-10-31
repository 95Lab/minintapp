// What the `live` brick's prefetch calls: one cached fetch per (source, params). With LIVE_DATA=off
// (offline/e2e builds only) it serves a fixed sample, flagged `sample: true`, instead of the network.
import { cachedLiveData, fetchFx, fetchWeather, type FxCode, type LiveData } from "./live-data-fetchers";

/** The state ETag of an app with a live block changes every bucket, so phones re-read refreshed data. */
export const LIVE_ETAG_BUCKET_MS = 5 * 60_000;
export const liveEtagBucket = (now = Date.now()) => Math.floor(now / LIVE_ETAG_BUCKET_MS);

export type LiveRequest = { source: "weather"; place: string } | { source: "fx"; base: FxCode; quote: FxCode };

export const liveCacheKey = (r: LiveRequest) => (r.source === "weather" ? `weather:${r.place.trim().toLowerCase()}` : `fx:${r.base}:${r.quote}`);

function sampleData(r: LiveRequest, now: number): LiveData {
  if (r.source === "fx") return { kind: "fx", base: r.base, quote: r.quote, rate: r.base === r.quote ? 1 : 25_000, updatedAt: now, fetchedAt: now, sample: true };
  const day = (offset: number, min: number, max: number, rainChance: number, code: number) => ({
    date: new Date(now + offset * 86_400_000).toISOString().slice(0, 10),
    min,
    max,
    rainChance,
    code,
  });
  return {
    kind: "weather",
    place: r.place.trim(),
    nowTemp: 21,
    nowCode: 3,
    days: [day(0, 16, 24, 60, 61), day(1, 15, 25, 20, 3), day(2, 15, 26, 10, 0)],
    fetchedAt: now,
    sample: true,
  };
}

/** Null when the upstream is unreachable or answers something unexpected (the card says so). */
export function loadLiveData(r: LiveRequest, now = Date.now()): Promise<LiveData | null> {
  if (process.env.LIVE_DATA === "off") return Promise.resolve(sampleData(r, now));
  return cachedLiveData(liveCacheKey(r), () => (r.source === "weather" ? fetchWeather(r.place.trim()) : fetchFx(r.base, r.quote)), now);
}
