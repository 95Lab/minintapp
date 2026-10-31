// Server-side fetchers for the `live` brick: weather (Open-Meteo) and exchange rates (open.er-api.com).
// Only these fixed hosts are ever called — the AI picks a source and plain parameters, never a URL —
// with a short timeout, a response size cap and a schema check. Results are cached per parameters, so
// a room of phones polling one app costs one upstream call per CACHE_MS.
import { z } from "zod";

export const CACHE_MS = 15 * 60_000;
const TIMEOUT_MS = 3_000;
const MAX_BYTES = 200_000;

export const FX_CODES = ["VND", "USD", "EUR", "JPY", "KRW", "CNY", "THB", "SGD", "GBP", "AUD", "TWD", "HKD", "MYR"] as const;
export type FxCode = (typeof FX_CODES)[number];

export interface WeatherDay {
  date: string;
  min: number;
  max: number;
  rainChance: number | null;
  code: number;
}
export interface WeatherData {
  kind: "weather";
  place: string;
  nowTemp: number;
  nowCode: number;
  days: WeatherDay[];
  fetchedAt: number;
  /** fixed sample served when LIVE_DATA=off (offline/e2e builds); never set by a real fetch */
  sample?: true;
}
export interface FxData {
  kind: "fx";
  base: FxCode;
  quote: FxCode;
  rate: number;
  updatedAt: number;
  fetchedAt: number;
  sample?: true;
}
export type LiveData = WeatherData | FxData;

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), redirect: "error", headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`upstream ${res.status}`);
  const text = await res.text();
  if (text.length > MAX_BYTES) throw new Error("upstream response too large");
  return JSON.parse(text);
}

const GeocodeSchema = z.object({
  results: z.array(z.object({ name: z.string(), latitude: z.number(), longitude: z.number(), country: z.string().optional() })).min(1),
});
const ForecastSchema = z.object({
  current: z.object({ temperature_2m: z.number(), weather_code: z.number() }),
  daily: z.object({
    time: z.array(z.string()),
    weather_code: z.array(z.number()),
    temperature_2m_max: z.array(z.number()),
    temperature_2m_min: z.array(z.number()),
    precipitation_probability_max: z.array(z.number().nullable()).optional(),
  }),
});
const FxSchema = z.object({ result: z.literal("success"), time_last_update_unix: z.number(), rates: z.record(z.string(), z.number()) });

export async function fetchWeather(place: string): Promise<WeatherData> {
  const geo = GeocodeSchema.parse(
    await getJson(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=vi&format=json&name=${encodeURIComponent(place)}`),
  ).results[0];
  const params = new URLSearchParams({
    latitude: String(geo.latitude),
    longitude: String(geo.longitude),
    current: "temperature_2m,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    timezone: "auto",
    forecast_days: "3",
  });
  const f = ForecastSchema.parse(await getJson(`https://api.open-meteo.com/v1/forecast?${params}`));
  return {
    kind: "weather",
    place: geo.country ? `${geo.name}, ${geo.country}` : geo.name,
    nowTemp: f.current.temperature_2m,
    nowCode: f.current.weather_code,
    days: f.daily.time.map((date, i) => ({
      date,
      min: f.daily.temperature_2m_min[i],
      max: f.daily.temperature_2m_max[i],
      rainChance: f.daily.precipitation_probability_max?.[i] ?? null,
      code: f.daily.weather_code[i],
    })),
    fetchedAt: Date.now(),
  };
}

export async function fetchFx(base: FxCode, quote: FxCode): Promise<FxData> {
  const fx = FxSchema.parse(await getJson(`https://open.er-api.com/v6/latest/${base}`));
  const rate = fx.rates[quote];
  if (typeof rate !== "number") throw new Error(`no rate for ${quote}`);
  return { kind: "fx", base, quote, rate, updatedAt: fx.time_last_update_unix * 1000, fetchedAt: Date.now() };
}

/** WMO weather code → a short label key (the UI words it per locale). */
export function weatherKind(code: number): "clear" | "cloudy" | "fog" | "rain" | "storm" | "snow" {
  if (code <= 1) return "clear";
  if (code <= 3) return "cloudy";
  if (code <= 48) return "fog";
  if (code >= 95) return "storm";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  return "rain";
}

type Entry = { at: number; value: Promise<LiveData | null> };
const cache = new Map<string, Entry>();
const MAX_CACHE_ENTRIES = 500;

/**
 * Cached fetch: one upstream call per key per CACHE_MS, shared by concurrent callers; a failure is
 * cached for a minute (null) so a dead upstream isn't hammered by every poll.
 */
export function cachedLiveData(key: string, load: () => Promise<LiveData>, now = Date.now()): Promise<LiveData | null> {
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_MS) return hit.value;
  if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value!);
  const value = load().catch((error) => {
    console.warn("[live-data]", key, error instanceof Error ? error.message : error);
    // retry after a minute instead of the full cache period
    cache.set(key, { at: now - CACHE_MS + 60_000, value: Promise.resolve(null) });
    return null;
  });
  cache.set(key, { at: now, value });
  return value;
}

export const resetLiveDataCache = () => cache.clear();
