import { AppSpecSchema, type Locale } from "@/lib/app-spec/app-spec-schema";
import type { ComposeInput, ComposeView } from "@/lib/blocks/compose/compose-atoms-schema";
import { E } from "@/lib/blocks/compose/expression/expr-types";
const field = (id: string, kind: ComposeInput["kind"], label: string, extra: Partial<ComposeInput> = {}): ComposeInput => ({ id, kind, label, required: true, options: null, multi: null, capacity: null, min: null, max: null, unit: null, showIf: null, timeLimitSec: null, ...extra });
const view = (id: string, kind: ComposeView["kind"], title: string, source: string | null, extra: Partial<ComposeView> = {}): ComposeView => ({ id, kind, title, source, op: null, topN: null, teams: null, query: null, visibleTo: "everyone", ...extra });
export function composeTemplate(id: string, locale: Locale) {
  const en = locale === "en";
  const base = { specVersion: 1, locale, description: null, theme: "forest", requireName: true, layout: "stack" };
  const block = { type: "compose", id: "form", note: null, entries: "one", flow: "open" };
  if (id === "compose-survey") return AppSpecSchema.parse({ ...base, title: en ? "Survey" : "Khảo sát nhiều trường", blocks: [{ ...block, title: en ? "Your feedback" : "Ý kiến của bạn", inputs: [
    field("topics", "choice", en ? "Topics" : "Chủ đề quan tâm", { multi: true, options: [{ id: "tech", label: "Công nghệ", price: null }, { id: "design", label: "Thiết kế", price: null }] }),
    field("detail", "text", en ? "Technology details" : "Chi tiết về công nghệ", { showIf: { input: "topics", equals: "tech" } }),
    field("score", "rating", en ? "Rating" : "Đánh giá", { max: 5 }),
    field("date", "date", en ? "Date" : "Ngày tham dự"),
  ], views: [view("topics", "bars", "Chủ đề", "topics"), view("average", "stat", "Đánh giá trung bình", "score", { op: "avg" }), view("words", "cloud", "Ý kiến", "detail"), view("table", "table", "Các câu trả lời", null, { visibleTo: "host" })] }] });
  if (id === "compose-expenses") return AppSpecSchema.parse({ ...base, title: en ? "Expense tracker" : "Sổ chi tiêu", blocks: [{ ...block, entries: "many", title: en ? "Expenses" : "Các khoản chi", inputs: [field("note", "text", en ? "Description" : "Nội dung"), field("amount", "number", en ? "Amount" : "Số tiền", { min: 0, unit: "VND" })], views: [
    view("total", "stat", "Tổng chi", "amount", { op: "sum" }),
    view("summary", "summary", "Tổng hợp theo người", null, { query: { where: null, groupBy: "$participant", measures: [{ key: "total", label: "Tổng chi", fn: "sum", expr: E.field("amount") }, { key: "count", label: "Số khoản", fn: "count", expr: null }], derived: [{ key: "percent", label: "Tỷ lệ %", expr: E.mul(E.div(E.field("total"), E.field("$total.total")), E.lit(100)) }], sort: { key: "total", dir: "desc" }, limit: 50 } }),
  ] }] });
  if (id === "compose-steps") return AppSpecSchema.parse({ ...base, title: en ? "Live feedback" : "Khảo sát từng bước", blocks: [{ ...block, flow: "steps", title: en ? "Live feedback" : "Đánh giá buổi học", inputs: [field("content", "rating", en ? "Content" : "Nội dung", { max: 5, timeLimitSec: 30 }), field("delivery", "rating", en ? "Delivery" : "Cách trình bày", { max: 5, timeLimitSec: 30 })], views: [view("content", "stat", "Điểm nội dung", "content", { op: "avg", visibleTo: "after_step" }), view("delivery", "stat", "Điểm trình bày", "delivery", { op: "avg", visibleTo: "after_step" })] }] });
  return null;
}
