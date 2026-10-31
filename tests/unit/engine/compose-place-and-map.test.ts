// Place input + map view: coordinate validation (3 decimals, in range), wiring (map reads only a place
// input), results (one dot per valid answer, own dot flagged, capped), sample answers and CSV text.
import { describe, expect, it } from "vitest";
import { AppSpecSchema, type ComposeBlock } from "@/engine/app-spec/app-spec-schema";
import { exampleWhereFrom } from "@/engine/app-spec/app-spec-examples-compose-map";
import type { AnswerRow, AppRuntime } from "@/engine/blocks/block-definition-types";
import { composeBlock, type ComposePayload } from "@/engine/blocks/compose/compose-block";
import { validateComposeAnswer } from "@/engine/blocks/compose/compose-answer-validation";
import { computeComposeResults } from "@/engine/blocks/compose/compose-results";
import { exportResponsesCsv } from "@/engine/responses/export-responses-csv";
import { parseLatLng } from "@/engine/geo/web-mercator-tiles";
import { runtimeSpec } from "./runtime-spec-test-helper";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ComposeMapCanvas } from "@/engine-ui/blocks/compose-map-canvas";

const runtime: AppRuntime = { openQuestionId: null, revealedQuestionIds: [] };
const block = AppSpecSchema.parse(structuredClone(exampleWhereFrom)).blocks[0] as ComposeBlock;
const hash = (c: string) => c.repeat(64);
const answer = (who: string, place: string, createdAt = 1): AnswerRow<ComposePayload> => ({
  blockId: block.id,
  itemId: "",
  participantHash: hash(who),
  displayName: who.toUpperCase(),
  payload: { kind: "compose", values: { place } },
  createdAt,
});
const mapOf = (answers: AnswerRow<ComposePayload>[], participantHash: string | null = hash("a")) => {
  const view = computeComposeResults(block, answers, { appStatus: "active", runtime, viewer: { isHost: false, participantHash } }).views[0];
  if (view.kind !== "map") throw new Error("expected a map view");
  return view.points;
};
const check = (place: unknown) => validateComposeAnswer(block, { kind: "compose", values: { place } as ComposePayload["values"] }, { itemId: "", runtime });

describe("place answers", () => {
  it("accept a point at up to 3 decimals", () => {
    expect(check("21.028,105.854")).toBeNull();
    expect(check("-33.9,18.4")).toBeNull();
    expect(check("0,0")).toBeNull();
  });
  it("refuse finer precision, out-of-range values and junk", () => {
    for (const bad of ["21.02849,105.854", "21.028,105.85412", "91,10", "10,181", "21.028;105.854", "21.028", "abc", "", "javascript:1,2", " 21.028,105.854"]) {
      expect(check(bad), bad).not.toBeNull();
    }
    expect(check(21.028)).toBe("bad_payload");
  });
  it("parseLatLng keeps the boundary values", () => {
    expect(parseLatLng("90,180")).toEqual({ lat: 90, lng: 180 });
    expect(parseLatLng("-90,-180")).toEqual({ lat: -90, lng: -180 });
  });
});

describe("map wiring", () => {
  const withBlock = (patch: (b: Record<string, unknown>) => void) => {
    const draft = structuredClone(exampleWhereFrom) as { blocks: Array<Record<string, unknown>> };
    patch(draft.blocks[0]);
    return AppSpecSchema.safeParse(draft).success;
  };
  const text = { id: "place", kind: "text", label: "Chữ", required: true, options: null, multi: null, capacity: null, min: null, max: null, unit: null };

  it("accepts the example", () => {
    expect(withBlock(() => {})).toBe(true);
  });
  it("rejects a map over a text input", () => {
    expect(withBlock((b) => (b.inputs = [text]))).toBe(false);
  });
  it("rejects other views over a place input", () => {
    expect(withBlock((b) => ((b.views as Array<Record<string, unknown>>)[0].kind = "cloud"))).toBe(false);
    expect(withBlock((b) => ((b.views as Array<Record<string, unknown>>)[0].kind = "bars"))).toBe(false);
  });
});

describe("map results", () => {
  it("gives one dot per answer with names, flagging the viewer's own", () => {
    const points = mapOf([answer("a", "21.028,105.854"), answer("b", "10.776,106.701", 2)]);
    expect(points).toEqual([
      { lat: 21.028, lng: 105.854, name: "A", mine: true },
      { lat: 10.776, lng: 106.701, name: "B", mine: false },
    ]);
  });
  it("shows no own dot to the host screen", () => {
    expect(mapOf([answer("a", "21.028,105.854")], null)[0].mine).toBe(false);
  });
  it("drops a stored value that isn't a valid point", () => {
    expect(mapOf([answer("a", "21.02849,105.854"), answer("b", "nonsense")])).toEqual([]);
  });
  it("keeps the newest 300 points", () => {
    const many = Array.from({ length: 320 }, (_, i) => answer(`${(i % 16).toString(16)}`, "10.5,106.5", i)).map((a, i) => ({ ...a, participantHash: `${i.toString(16).padStart(4, "0")}${"0".repeat(60)}` }));
    expect(mapOf(many)).toHaveLength(300);
  });
});

describe("place sample answers and export", () => {
  it("sample answers are valid places", () => {
    for (let i = 1; i <= 20; i++) {
      const a = composeBlock.sampleAnswer!(block, runtime, () => (i * 0.047) % 1);
      expect(a && check(a.payload.values.place)).toBeNull();
    }
  });
  it("CSV prints the point as lat,lng (quoted, since it holds a comma)", () => {
    const spec = runtimeSpec(exampleWhereFrom);
    const csv = exportResponsesCsv(spec, [{ blockId: block.id, itemId: "", participantHash: hash("a"), displayName: "An", payload: { kind: "compose", values: { place: "21.028,105.854" } }, createdAt: 1 }]);
    expect(csv).toContain('"Vị trí của bạn: 21.028,105.854"');
  });
});

describe("map tiles", () => {
  it("send only our origin as referrer (OSM tile policy), and only the tiles do", () => {
    const html = renderToStaticMarkup(
      createElement(ComposeMapCanvas, { makeView: (width, height) => ({ zoom: 3, left: 0, top: 0, width, height }), locale: "vi", children: () => null }),
    );
    const tiles = html.match(/<img[^>]*tile\.openstreetmap\.org[^>]*>/g) ?? [];
    expect(tiles.length).toBeGreaterThan(0);
    for (const tile of tiles) {
      expect(tile).toContain('referrerPolicy="strict-origin-when-cross-origin"');
      expect(tile).not.toContain("no-referrer");
    }
  });
});
