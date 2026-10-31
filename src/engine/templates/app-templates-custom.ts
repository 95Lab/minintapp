// Templates built on the sandboxed `custom` brick (an AI-written page). Opening one is instant: the
// page is fixed code, not generated.
import { exampleTapSpeedGame, tapGameHtml, TAP_GAME_EN } from "@/engine/app-spec/app-spec-examples-custom";
import type { AppTemplate } from "./app-templates";

export const CUSTOM_TEMPLATES: AppTemplate[] = [
  {
    id: "tap-speed-game",
    kind: "custom",
    title: { vi: "Thi bấm nhanh 10 giây", en: "10-second tap race" },
    blurb: { vi: "Mini game, điểm cao nhất lên bảng top 5", en: "Mini game, best scores on a top-5 board" },
    spec: {
      vi: exampleTapSpeedGame,
      en: {
        ...structuredClone(exampleTapSpeedGame),
        locale: "en",
        title: "10-second tap race",
        description: "Tap as many times as you can in 10 seconds. Your best score goes on the top-5 board.",
        blocks: [{ type: "custom", id: "tap-game", title: "Tap race", html: tapGameHtml(TAP_GAME_EN) }],
      },
    },
  },
];
