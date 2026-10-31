// "Where are you from?": everyone shares one location (or taps the map) and the room sees every dot
// on an OpenStreetMap map. Used as a template and as a conformance fixture.
import type { AppSpecDraft } from "./app-spec-schema";

const noOpts = { options: null, multi: null, capacity: null, min: null, max: null, unit: null };

function whereAreYouFrom(t: { title: string; description: string; block: string; note: string; place: string; view: string }, locale: "vi" | "en"): AppSpecDraft {
  return {
    specVersion: 1,
    locale,
    title: t.title,
    description: t.description,
    theme: "ocean",
    requireName: true,
    blocks: [
      {
        type: "compose",
        id: "where",
        title: t.block,
        note: t.note,
        entries: "one",
        inputs: [{ id: "place", kind: "place", label: t.place, required: true, ...noOpts }],
        views: [{ id: "map", kind: "map", title: t.view, source: "place", op: null, topN: null, visibleTo: "everyone" }],
      },
    ],
  };
}

export const exampleWhereFrom: AppSpecDraft = whereAreYouFrom(
  {
    title: "Bạn đến từ đâu?",
    description: "Mỗi người chia sẻ một vị trí; cả phòng thấy mọi người trên bản đồ.",
    block: "Bạn đến từ đâu?",
    note: "Vị trí được làm tròn khoảng 100 m trước khi gửi.",
    place: "Vị trí của bạn",
    view: "Bản đồ cả phòng",
  },
  "vi",
);

export const exampleWhereFromEn: AppSpecDraft = whereAreYouFrom(
  {
    title: "Where are you from?",
    description: "Everyone shares a location; the whole room sees everybody on the map.",
    block: "Where are you from?",
    note: "Your location is rounded to about 100 m before it is sent.",
    place: "Your location",
    view: "Room map",
  },
  "en",
);
