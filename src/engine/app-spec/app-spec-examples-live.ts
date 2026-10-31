// Example of the `live` brick: a weekend trip with a live weather card next to a vote on the plan.
// Used as a template and as a conformance fixture.
import type { AppSpecDraft } from "./app-spec-schema";

interface TripText {
  title: string;
  description: string;
  place: string;
  weatherTitle: string;
  question: string;
  options: [string, string, string];
}

function weekendTrip(t: TripText, locale: "vi" | "en"): AppSpecDraft {
  const [a, b, c] = t.options;
  return {
    specVersion: 1,
    locale,
    title: t.title,
    description: t.description,
    theme: "forest",
    requireName: false,
    blocks: [
      { type: "live", id: "weather", title: t.weatherTitle, source: "weather", place: t.place, base: null, quote: null },
      {
        type: "choice",
        id: "plan",
        question: t.question,
        options: [
          { id: "hills", label: a },
          { id: "cafe", label: b },
          { id: "market", label: c },
        ],
        multi: true,
        showResults: "live",
      },
    ],
  };
}

export const exampleWeekendTrip = weekendTrip(
  {
    title: "Đi Đà Lạt cuối tuần",
    description: "Xem thời tiết Đà Lạt rồi chọn các việc cả nhóm muốn làm.",
    place: "Đà Lạt",
    weatherTitle: "Thời tiết Đà Lạt",
    question: "Cả nhóm muốn làm gì?",
    options: ["Săn mây đồi chè", "Cà phê view đẹp", "Dạo chợ đêm"],
  },
  "vi",
);

export const exampleWeekendTripEn = weekendTrip(
  {
    title: "Dalat weekend trip",
    description: "Check the Dalat weather, then pick what the group wants to do.",
    place: "Dalat",
    weatherTitle: "Dalat weather",
    question: "What does the group want to do?",
    options: ["Chase clouds on the tea hills", "Coffee with a view", "Night market stroll"],
  },
  "en",
);

/** Travel budget: an exchange-rate card with a converter, for groups spending abroad. */
export const exampleTravelRate: AppSpecDraft = {
  specVersion: 1,
  locale: "vi",
  title: "Tỷ giá đi Nhật",
  description: "Đổi nhanh yên Nhật sang đồng khi tính ngân sách chuyến đi.",
  theme: "ocean",
  requireName: false,
  blocks: [{ type: "live", id: "rate", title: "Yên Nhật sang đồng", source: "fx", place: null, base: "JPY", quote: "VND" }],
};
