// AppSpecs assembled from compose atoms — needs no preset brick covers. Used as few-shot examples,
// templates and mock-generator output, so they double as a check that the atoms fit real requests.
import type { AppSpecDraft } from "./app-spec-schema";

export const exampleTripSplit: AppSpecDraft = {
  specVersion: 1,
  locale: "vi",
  title: "Chia tiền chuyến đi Đà Lạt",
  description: "Mỗi người nhập số tiền mình đã chi, app tính ai chuyển cho ai.",
  theme: "forest",
  requireName: true,
  blocks: [
    {
      type: "compose",
      id: "trip",
      title: "Bạn đã chi bao nhiêu?",
      note: "Chưa chi gì thì nhập 0.",
      inputs: [
        { id: "paid", kind: "number", label: "Số tiền đã chi", required: true, options: null, multi: null, capacity: null, min: 0, max: 100000000, unit: "đ" },
        { id: "for", kind: "text", label: "Chi cho việc gì", required: false, options: null, multi: null, capacity: null, min: null, max: null, unit: null },
      ],
      views: [
        { id: "settle", kind: "split", title: "Ai chuyển cho ai", source: "paid", op: null, topN: null, visibleTo: "everyone" },
        { id: "detail", kind: "table", title: "Chi tiết", source: null, op: null, topN: null, visibleTo: "everyone" },
      ],
    },
  ],
};

export const exampleSignupSlots: AppSpecDraft = {
  specVersion: 1,
  locale: "vi",
  title: "Picnic cuối tuần: ai mang gì?",
  description: "Mỗi món tối đa 2 người. Hết chỗ thì vào danh sách chờ.",
  theme: "sunset",
  requireName: true,
  blocks: [
    {
      type: "compose",
      id: "picnic",
      title: "Bạn mang gì?",
      note: null,
      inputs: [
        {
          id: "item",
          kind: "slot",
          label: "Chọn món",
          required: true,
          options: [
            { id: "banh-mi", label: "Bánh mì", price: null },
            { id: "nuoc", label: "Nước uống", price: null },
            { id: "trai-cay", label: "Trái cây", price: null },
            { id: "tham", label: "Thảm + đồ chơi", price: null },
          ],
          multi: null,
          capacity: 2,
          min: null,
          max: null,
          unit: null,
        },
      ],
      views: [{ id: "who", kind: "groups", title: "Ai mang gì", source: "item", op: null, topN: null, visibleTo: "everyone" }],
    },
  ],
};

export const exampleSessionRating: AppSpecDraft = {
  specVersion: 1,
  locale: "vi",
  title: "Đánh giá buổi workshop",
  description: "Chấm sao và góp ý ngắn, ẩn danh.",
  theme: "ocean",
  requireName: false,
  blocks: [
    {
      type: "compose",
      id: "feedback",
      title: "Buổi hôm nay thế nào?",
      note: null,
      inputs: [
        { id: "stars", kind: "rating", label: "Chấm điểm", required: true, options: null, multi: null, capacity: null, min: null, max: 5, unit: null },
        { id: "comment", kind: "text", label: "Một điều nên cải thiện", required: false, options: null, multi: null, capacity: null, min: null, max: null, unit: null },
      ],
      views: [
        { id: "avg", kind: "stat", title: "Điểm trung bình", source: "stars", op: "avg", topN: null, visibleTo: "everyone" },
        { id: "dist", kind: "bars", title: "Phân bố sao", source: "stars", op: null, topN: null, visibleTo: "everyone" },
        { id: "ideas", kind: "table", title: "Góp ý", source: null, op: null, topN: null, visibleTo: "host" },
      ],
    },
  ],
};
