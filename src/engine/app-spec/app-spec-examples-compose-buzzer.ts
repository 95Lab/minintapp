// Buzzer game: the host opens a round, phones get one big button, the first press wins the round.
// Press times are the server's receive times. Used as a template and as a conformance fixture.
import type { AppSpecDraft } from "./app-spec-schema";

const noOpts = { options: null, multi: null, capacity: null, min: null, max: null, unit: null };

function buzzer(t: { title: string; description: string; block: string; note: string; round: (n: number) => string; view: string }, locale: "vi" | "en"): AppSpecDraft {
  return {
    specVersion: 1,
    locale,
    title: t.title,
    description: t.description,
    theme: "sunset",
    requireName: true,
    blocks: [
      {
        type: "compose",
        id: "buzzer",
        title: t.block,
        note: t.note,
        flow: "steps",
        inputs: [1, 2, 3].map((n) => ({ id: `round${n}`, kind: "buzz" as const, label: t.round(n), required: true, ...noOpts })),
        views: [{ id: "who", kind: "fastest", title: t.view, source: null, op: null, topN: null, visibleTo: "everyone" }],
      },
    ],
  };
}

export const exampleBuzzer: AppSpecDraft = buzzer(
  {
    title: "Bấm chuông giành quyền trả lời",
    description: "Host mở từng vòng, ai bấm trước được quyền trả lời.",
    block: "Bấm chuông",
    note: "Chờ host mở vòng rồi bấm thật nhanh!",
    round: (n) => `Vòng ${n}`,
    view: "Ai nhanh nhất",
  },
  "vi",
);

export const exampleBuzzerEn: AppSpecDraft = buzzer(
  {
    title: "Buzz in to answer",
    description: "The host opens each round; the first to buzz gets to answer.",
    block: "Buzzer",
    note: "Wait for the host to open a round, then buzz fast!",
    round: (n) => `Round ${n}`,
    view: "Fastest fingers",
  },
  "en",
);
