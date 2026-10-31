// Errors travel as codes and are worded by the client in the app's language; results carry their
// few built-in words (anonymous name, waitlist mark) in the app's language too.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ERROR_CODES, errorText } from "@/engine/api/app-error-codes";
import type { ComposeBlock } from "@/engine/app-spec/app-spec-schema";
import { examplePasswordQuiz } from "@/engine/app-spec/app-spec-examples";
import { exampleSignupSlots } from "@/engine/app-spec/app-spec-examples-compose";
import { appsRepository, resetMemoryStore } from "@/engine/db/apps-repository";
import { computeResults } from "@/engine/responses/compute-results";
import { POST as blockAction } from "@/app/api/engine/apps/[id]/block-action/route";
import { runtimeSpec } from "./runtime-spec-test-helper";

const VIETNAMESE = /[ạảấầậắặẹẻếềểệịọỏốồổộớờởợụủứừửựỳỷđ]/;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? files(join(dir, n)) : n.endsWith(".ts") ? [join(dir, n)] : []));
}

describe("error codes", () => {
  it("have text in every language with the same placeholders", () => {
    // A params object that records which placeholders a template reads.
    const placeholders = (code: string, locale: "vi" | "en") => {
      const read = new Set<string>();
      const params = new Proxy({}, { get: (_t, key) => (read.add(String(key)), "x") }) as Record<string, string>;
      errorText(code, locale, params);
      return [...read].sort();
    };
    for (const code of ERROR_CODES) {
      expect(errorText(code, "vi"), code).not.toBe("");
      expect(errorText(code, "en"), code).not.toMatch(VIETNAMESE);
      expect(placeholders(code, "en"), code).toEqual(placeholders(code, "vi"));
    }
    expect(errorText("entries_limit", "en", { max: 50 })).toBe("You've reached the maximum of 50 entries.");
    expect(errorText("entries_limit", "vi", { max: 50 })).toBe("Bạn đã đạt tối đa 50 dòng.");
  });

  it("word unknown codes generically instead of showing raw server text", () => {
    expect(errorText("some_future_code", "en")).toBe("Something went wrong.");
    expect(errorText(undefined, "vi")).toBe("Có lỗi xảy ra.");
  });

  it("leave no Vietnamese wording in API routes (sample participant names excepted)", () => {
    const offenders = files(resolve(__dirname, "../../src/app/api")).flatMap((f) =>
      readFileSync(f, "utf8")
        .split("\n")
        .map((line, i) => ({ f, i: i + 1, line }))
        .filter(({ line }) => VIETNAMESE.test(line) && !/^\s*\/\//.test(line) && !line.startsWith("const NAMES")),
    );
    expect(offenders.map(({ f, i }) => `${f}:${i}`)).toEqual([]);
  });

  it("come back from a real route as { code }, with the Vietnamese message kept for old clients", async () => {
    resetMemoryStore();
    const { app } = await appsRepository().createApp({ spec: runtimeSpec(examplePasswordQuiz), prompt: "t", lifetimeMs: 3_600_000 });
    const res = await blockAction(new Request("http://x", { method: "POST", body: "{}" }), { params: Promise.resolve({ id: app.id }) });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ ok: false, code: "host_only", message: "Chỉ host thực hiện được." });
  });
});

describe("words inside results follow the app's language", () => {
  it("anonymous names and the waitlist mark", async () => {
    resetMemoryStore();
    // Two seats, three unnamed people pick the same item: the third waits.
    const base = runtimeSpec(exampleSignupSlots);
    const block = base.blocks[0] as ComposeBlock;
    const withTable = { ...block, views: [...block.views, { ...block.views[0], id: "all", kind: "table" as const, source: null, visibleTo: "host" as const }] };
    const spec = { ...base, blocks: [withTable] };
    const { app } = await appsRepository().createApp({ spec, prompt: "t", lifetimeMs: 3_600_000 });
    const responses = [1, 2, 3].map((n) => ({
      blockId: block.id,
      itemId: "",
      participantHash: String(n).repeat(64),
      displayName: null,
      payload: { kind: "compose" as const, values: { item: "banh-mi" } },
      createdAt: n,
    }));
    const text = (locale: "vi" | "en") => JSON.stringify(computeResults({ ...app, spec: { ...spec, locale } }, responses as never, { isHost: true, participantHash: null }));
    expect(text("en")).toContain("Anonymous 3");
    expect(text("en")).toContain("(waitlist)");
    expect(text("en")).not.toMatch(/Ẩn danh|\(chờ\)/);
    expect(text("vi")).toContain("Ẩn danh 3");
    expect(text("vi")).toContain("(chờ)");
  });
});
