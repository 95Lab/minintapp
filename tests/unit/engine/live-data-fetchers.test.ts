// Live data fetchers: fixed hosts only, schema-checked, cached, failures cached briefly as null.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cachedLiveData, CACHE_MS, fetchFx, fetchWeather, resetLiveDataCache, weatherKind } from "@/engine/live-data/live-data-fetchers";

const geocode = { results: [{ name: "Đà Lạt", latitude: 11.946, longitude: 108.442, country: "Việt Nam" }] };
const forecast = {
  current: { temperature_2m: 21.7, weather_code: 51 },
  daily: {
    time: ["2026-10-30", "2026-10-31", "2026-11-01"],
    weather_code: [61, 3, 0],
    temperature_2m_max: [24, 25, 26],
    temperature_2m_min: [16, 15, 15],
    precipitation_probability_max: [80, 20, null],
  },
};
const fx = { result: "success", time_last_update_unix: 1_793_318_400, rates: { USD: 1, VND: 26_250 } };

let calls: string[];
function serve(routes: Record<string, unknown>) {
  vi.stubGlobal("fetch", async (url: string) => {
    calls.push(url);
    const hit = Object.entries(routes).find(([prefix]) => url.startsWith(prefix));
    return hit ? new Response(JSON.stringify(hit[1])) : new Response("nope", { status: 404 });
  });
}

beforeEach(() => {
  calls = [];
  resetLiveDataCache();
});
afterEach(() => vi.unstubAllGlobals());

describe("live data", () => {
  it("geocodes the place, then reads a 3-day forecast", async () => {
    serve({ "https://geocoding-api.open-meteo.com/": geocode, "https://api.open-meteo.com/": forecast });
    const w = await fetchWeather("Đà Lạt");
    expect(w.place).toBe("Đà Lạt, Việt Nam");
    expect(w.days).toHaveLength(3);
    expect(w.days[2].rainChance).toBeNull();
    expect(calls[0]).toContain("name=%C4%90%C3%A0%20L%E1%BA%A1t");
    expect(calls.every((u) => u.startsWith("https://geocoding-api.open-meteo.com/") || u.startsWith("https://api.open-meteo.com/"))).toBe(true);
  });

  it("reads one exchange rate and refuses a missing one", async () => {
    serve({ "https://open.er-api.com/v6/latest/USD": fx });
    expect((await fetchFx("USD", "VND")).rate).toBe(26_250);
    await expect(fetchFx("USD", "JPY")).rejects.toThrow();
  });

  it("refuses an unexpected shape", async () => {
    serve({ "https://open.er-api.com/": { result: "error" } });
    await expect(fetchFx("USD", "VND")).rejects.toThrow();
  });

  it("caches per key, and caches a failure as null only briefly", async () => {
    const load = vi.fn(async () => ({ kind: "fx" as const, base: "USD" as const, quote: "VND" as const, rate: 1, updatedAt: 0, fetchedAt: 0 }));
    await cachedLiveData("fx:USD:VND", load, 0);
    await cachedLiveData("fx:USD:VND", load, CACHE_MS - 1);
    expect(load).toHaveBeenCalledTimes(1);
    const failing = vi.fn(async () => {
      throw new Error("down");
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await cachedLiveData("weather:x", failing, 0)).toBeNull();
    expect(await cachedLiveData("weather:x", failing, 30_000)).toBeNull();
    expect(failing).toHaveBeenCalledTimes(1);
    await cachedLiveData("weather:x", failing, 61_000);
    expect(failing).toHaveBeenCalledTimes(2);
  });

  it("words WMO codes into a few kinds", () => {
    expect([0, 3, 45, 61, 95, 73].map(weatherKind)).toEqual(["clear", "cloudy", "fog", "rain", "storm", "snow"]);
  });
});
