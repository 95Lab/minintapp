import { afterEach, expect, it, vi } from "vitest";
import { fetchState } from "@/engine/api/api-client";
afterEach(() => vi.unstubAllGlobals());
it("treats the gateway's plain-text 404 for a removed app as gone, not as a lost connection", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("404 page not found\n", { status: 404, headers: { "Content-Type": "text/plain" } })));
  expect(await fetchState("a".repeat(24), {})).toMatchObject({ kind: "gone", gone: { reason: "not_found" } });
});
