// Ranked-choice app: everyone orders the options by preference, the room sees Borda points.
// Used as a template and as a conformance fixture.
import type { AppSpecDraft } from "./app-spec-schema";

const noOpts = { options: null, multi: null, capacity: null, min: null, max: null, unit: null };

function rankedChoice(t: { title: string; description: string; block: string; label: string; options: string[]; view: string }, locale: "vi" | "en"): AppSpecDraft {
  return {
    specVersion: 1,
    locale,
    title: t.title,
    description: t.description,
    theme: "sunset",
    requireName: false,
    blocks: [
      {
        type: "compose",
        id: "priorities",
        title: t.block,
        note: null,
        inputs: [
          {
            id: "order",
            kind: "rank",
            label: t.label,
            required: true,
            ...noOpts,
            options: t.options.map((label, i) => ({ id: `o${i + 1}`, label, price: null })),
            max: 3,
          },
        ],
        views: [{ id: "result", kind: "ranking", title: t.view, source: "order", op: null, topN: null, visibleTo: "after_submit" }],
      },
    ],
  };
}

export const exampleRankedChoice: AppSpecDraft = rankedChoice(
  {
    title: "Ưu tiên tính năng quý tới",
    description: "Xếp 3 tính năng bạn muốn nhất theo thứ tự; hạng 1 được 3 điểm, hạng 2 được 2, hạng 3 được 1.",
    block: "Xếp hạng ưu tiên",
    label: "Chọn 3 tính năng theo thứ tự",
    options: ["Chế độ tối", "Xuất PDF", "Đăng nhập Google", "Thông báo", "Tìm kiếm nhanh"],
    view: "Bảng điểm ưu tiên",
  },
  "vi",
);

export const exampleRankedChoiceEn: AppSpecDraft = rankedChoice(
  {
    title: "Next quarter's priorities",
    description: "Rank your top 3 features; 1st gets 3 points, 2nd 2, 3rd 1.",
    block: "Rank the priorities",
    label: "Pick 3 features in order",
    options: ["Dark mode", "PDF export", "Google sign-in", "Notifications", "Quick search"],
    view: "Priority points",
  },
  "en",
);
