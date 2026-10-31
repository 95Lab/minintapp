// Templates built on the `live` brick (weather / exchange rate). The data is fetched when the app is
// opened; nothing in the spec is generated.
import { exampleTravelRate, exampleWeekendTrip, exampleWeekendTripEn } from "@/engine/app-spec/app-spec-examples-live";
import type { AppTemplate } from "./app-templates";

export const LIVE_TEMPLATES: AppTemplate[] = [
  {
    id: "weekend-trip-weather",
    kind: "live",
    title: { vi: "Đi Đà Lạt cuối tuần (thời tiết)", en: "Dalat weekend (weather)" },
    blurb: { vi: "Dự báo 3 ngày kèm bình chọn việc cần làm", en: "3-day forecast with a vote on what to do" },
    spec: { vi: exampleWeekendTrip, en: exampleWeekendTripEn },
  },
  {
    id: "travel-exchange-rate",
    kind: "live",
    title: { vi: "Tỷ giá đi Nhật", en: "Japan trip exchange rate" },
    blurb: { vi: "Tỷ giá yên Nhật sang đồng, có đổi nhanh", en: "Yen to dong rate with a quick converter" },
    spec: {
      vi: exampleTravelRate,
      en: {
        ...structuredClone(exampleTravelRate),
        locale: "en",
        title: "Japan trip exchange rate",
        description: "Quickly convert yen to dong when planning the trip budget.",
        blocks: [{ type: "live", id: "rate", title: "Yen to dong", source: "fx", place: null, base: "JPY", quote: "VND" }],
      },
    },
  },
];
