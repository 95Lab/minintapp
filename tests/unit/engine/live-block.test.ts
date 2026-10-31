// The `live` brick: spec rules per source, no answers accepted, data reaching results through
// prefetch (stubbed fetch), the sample mode, and the state ETag moving with time.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exampleTravelRate, exampleWeekendTrip } from "@/engine/app-spec/app-spec-examples-live";
import { stateEtag } from "@/engine/api/route-helpers";
import { appsRepository, resetMemoryStore } from "@/engine/db/apps-repository";
import { liveBlock, LiveBlockSchema, type LiveResults } from "@/engine/blocks/live/live-block";
import { vocabularyEntry } from "@/engine/blocks/block-vocabulary";
import { resetLiveDataCache } from "@/engine/live-data/live-data-fetchers";
import { LIVE_ETAG_BUCKET_MS } from "@/engine/live-data/live-data-loader";
import { computeResults, prefetchBlocks } from "@/engine/responses/compute-results";
import { runtimeSpec } from "./runtime-spec-test-helper";

const base = { type: "live", id: "w", title: "Thời tiết" } as const;
const weather = { ...base, source: "weather", place: "Đà Lạt", base: null, quote: null } as const;
const fx = { ...base, source: "fx", place: null, base: "USD", quote: "VND" } as const;

describe("live block spec", () => {
  it("accepts a weather and an fx block", () => {
    expect(LiveBlockSchema.safeParse(weather).success).toBe(true);
    expect(LiveBlockSchema.safeParse(fx).success).toBe(true);
  });

  it("weather needs a place; fx needs two different known currencies", () => {
    expect(LiveBlockSchema.safeParse({ ...weather, place: null }).success).toBe(false);
    expect(LiveBlockSchema.safeParse({ ...fx, base: null }).success).toBe(false);
    expect(LiveBlockSchema.safeParse({ ...fx, quote: null }).success).toBe(false);
    expect(LiveBlockSchema.safeParse({ ...fx, quote: "USD" }).success).toBe(false);
    expect(LiveBlockSchema.safeParse({ ...fx, quote: "XYZ" }).success).toBe(false);
    expect(LiveBlockSchema.safeParse({ ...base, source: "gold", place: "x", base: null, quote: null }).success).toBe(false);
  });

  it("refuses long places and anything URL-like", () => {
    expect(LiveBlockSchema.safeParse({ ...weather, place: "a".repeat(61) }).success).toBe(false);
    for (const place of ["https://evil.test", "evil.test/path", "www.evil.test", "a@b", "<b>x</b>"]) {
      expect(LiveBlockSchema.safeParse({ ...weather, place }).success, place).toBe(false);
    }
  });

  it("the AI flat form drops the other source's params and infers a missing source", () => {
    const entry = vocabularyEntry("live");
    expect(entry.fromFlat({ id: "w", title: "T", liveSource: "weather", place: " Huế ", base: "USD", quote: "VND" })).toMatchObject({ source: "weather", place: "Huế", base: null, quote: null });
    expect(entry.fromFlat({ id: "r", title: "T", liveSource: null, place: null, base: "usd", quote: "vnd" })).toMatchObject({ source: "fx", base: "USD", quote: "VND", place: null });
  });

  it("nobody can answer it", () => {
    expect(liveBlock.validate(weather, { kind: "live" }, { itemId: "", runtime: { openQuestionId: null, revealedQuestionIds: [] } })).toBe("bad_payload");
    expect(liveBlock.payloadSchema.safeParse({ kind: "live", extra: 1 }).success).toBe(false);
  });
});

const geocode = { results: [{ name: "Đà Lạt", latitude: 11.9, longitude: 108.4, country: "Việt Nam" }] };
const forecast = {
  current: { temperature_2m: 20.2, weather_code: 3 },
  daily: { time: ["2026-10-30", "2026-10-31", "2026-11-01"], weather_code: [61, 3, 0], temperature_2m_max: [24, 25, 26], temperature_2m_min: [16, 15, 15], precipitation_probability_max: [80, 20, 10] },
};
const rates = { result: "success", time_last_update_unix: 1_793_318_400, rates: { JPY: 1, VND: 170 } };

function stubFetch() {
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => {
    calls.push(url);
    if (url.startsWith("https://geocoding-api.open-meteo.com/")) return new Response(JSON.stringify(geocode));
    if (url.startsWith("https://api.open-meteo.com/")) return new Response(JSON.stringify(forecast));
    if (url.startsWith("https://open.er-api.com/")) return new Response(JSON.stringify(rates));
    return new Response("nope", { status: 404 });
  });
  return calls;
}

describe("live data reaches results", () => {
  beforeEach(() => {
    resetMemoryStore();
    resetLiveDataCache();
    vi.stubEnv("LIVE_DATA", "");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  async function appWith(draft: typeof exampleWeekendTrip) {
    const { app } = await appsRepository().createApp({ spec: runtimeSpec(draft), prompt: "t", lifetimeMs: 3_600_000 });
    return app;
  }

  it("prefetch fetches once per key and computeResults shows the data", async () => {
    const calls = stubFetch();
    const app = await appWith(exampleWeekendTrip);
    const first = await prefetchBlocks(app.spec);
    await prefetchBlocks(app.spec);
    expect(calls).toHaveLength(2); // geocode + forecast, the second prefetch hit the cache
    const results = computeResults(app, [], { isHost: false, participantHash: null }, first);
    const live = results[0] as LiveResults;
    expect(live.data).toMatchObject({ kind: "weather", place: "Đà Lạt, Việt Nam", nowTemp: 20.2 });
    expect(live.data && "sample" in live.data).toBe(false);
    expect(results[1]).not.toBeNull(); // the vote still computes
  });

  it("fx reads the base's rates and picks the quote", async () => {
    stubFetch();
    const app = await appWith(exampleTravelRate);
    const live = computeResults(app, [], { isHost: true, participantHash: null }, await prefetchBlocks(app.spec))[0] as LiveResults;
    expect(live.data).toMatchObject({ kind: "fx", base: "JPY", quote: "VND", rate: 170 });
  });

  it("an unreachable upstream gives a card without data, and the rest of the app still works", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", async () => {
      throw new Error("offline");
    });
    const app = await appWith(exampleWeekendTrip);
    const results = computeResults(app, [], { isHost: true, participantHash: null }, await prefetchBlocks(app.spec));
    expect((results[0] as LiveResults).data).toBeNull();
    expect(results[1]).not.toBeNull();
  });

  it("without prefetched data the card is empty rather than failing", async () => {
    const app = await appWith(exampleWeekendTrip);
    expect((computeResults(app, [], { isHost: true, participantHash: null })[0] as LiveResults).data).toBeNull();
  });

  it("LIVE_DATA=off serves a labelled sample and never calls the network", async () => {
    const calls = stubFetch();
    vi.stubEnv("LIVE_DATA", "off");
    const app = await appWith(exampleWeekendTrip);
    const live = computeResults(app, [], { isHost: true, participantHash: null }, await prefetchBlocks(app.spec))[0] as LiveResults;
    expect(calls).toHaveLength(0);
    expect(live.data).toMatchObject({ kind: "weather", place: "Đà Lạt", sample: true });
  });

  it("the state ETag changes with time for an app with a live block, and only for those", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-30T10:00:00Z"));
    const req = new Request("http://localhost/api/engine/apps/x/state");
    const liveApp = await appWith(exampleWeekendTrip);
    const plain = (await appsRepository().createApp({ spec: runtimeSpec({ ...exampleWeekendTrip, blocks: [exampleWeekendTrip.blocks[1]] }), prompt: "t", lifetimeMs: 3_600_000 })).app;
    const [liveBefore, plainBefore] = [stateEtag(liveApp, req), stateEtag(plain, req)];
    expect(stateEtag(liveApp, req)).toBe(liveBefore);
    vi.setSystemTime(Date.now() + LIVE_ETAG_BUCKET_MS);
    expect(stateEtag(liveApp, req)).not.toBe(liveBefore);
    expect(stateEtag(plain, req)).toBe(plainBefore);
  });
});
