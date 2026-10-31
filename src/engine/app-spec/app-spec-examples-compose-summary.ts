// A compose app built on a `summary` view: spending per category with each category's share of the
// total — a calculation no built-in view does, written as a query. Used as a template, as the
// few-shot that teaches the model the query shape (it must also declare the number input the query
// reads), and as a conformance fixture.
import type { AppSpecDraft } from "./app-spec-schema";

const noOpts = { options: null, multi: null, capacity: null, min: null, max: null, unit: null };

const percentOfTotal = (measure: string) => ({
  op: "call" as const,
  fn: "round",
  args: [
    {
      op: "mul" as const,
      args: [
        { op: "div" as const, args: [{ op: "field" as const, key: measure }, { op: "field" as const, key: `$total.${measure}` }] as const },
        { op: "lit" as const, v: 100 },
      ] as const,
    },
    { op: "lit" as const, v: 1 },
  ],
});

function expenseByCategory(t: { title: string; description: string; block: string; amount: string; category: string; options: [string, string, string]; view: string; spent: string; count: string; share: string }, locale: "vi" | "en"): AppSpecDraft {
  const [food, transport, hotel] = t.options;
  return {
    specVersion: 1,
    locale,
    title: t.title,
    description: t.description,
    theme: "forest",
    requireName: true,
    blocks: [
      {
        type: "compose",
        id: "expenses",
        title: t.block,
        note: null,
        entries: "many",
        inputs: [
          { id: "amount", kind: "number", label: t.amount, required: true, ...noOpts, min: 0, max: 100000000, unit: "đ" },
          {
            id: "category",
            kind: "choice",
            label: t.category,
            required: true,
            ...noOpts,
            options: [
              { id: "food", label: food, price: null },
              { id: "transport", label: transport, price: null },
              { id: "hotel", label: hotel, price: null },
            ],
            multi: false,
          },
        ],
        views: [
          {
            id: "by-category",
            kind: "summary",
            title: t.view,
            source: null,
            op: null,
            topN: null,
            visibleTo: "everyone",
            query: {
              groupBy: "category",
              measures: [
                { key: "spent", label: t.spent, fn: "sum", expr: { op: "field", key: "amount" } },
                { key: "count", label: t.count, fn: "count", expr: null },
              ],
              derived: [{ key: "share", label: t.share, expr: percentOfTotal("spent") }],
              sort: { key: "spent", dir: "desc" },
            },
          },
        ],
      },
    ],
  };
}

export const exampleExpenseByCategory: AppSpecDraft = expenseByCategory(
  {
    title: "Chi tiêu chuyến đi theo loại",
    description: "Mỗi khoản chi một dòng; xem tổng từng loại và phần trăm trên tổng chi.",
    block: "Ghi khoản chi",
    amount: "Số tiền",
    category: "Loại",
    options: ["Ăn uống", "Di chuyển", "Khách sạn"],
    view: "Chi theo loại",
    spent: "Đã chi",
    count: "Số khoản",
    share: "% tổng",
  },
  "vi",
);

export const exampleExpenseByCategoryEn: AppSpecDraft = expenseByCategory(
  {
    title: "Trip spending by category",
    description: "One line per expense; see each category's total and share of all spending.",
    block: "Log an expense",
    amount: "Amount",
    category: "Category",
    options: ["Food", "Transport", "Hotel"],
    view: "Spending by category",
    spent: "Spent",
    count: "Expenses",
    share: "% of total",
  },
  "en",
);
