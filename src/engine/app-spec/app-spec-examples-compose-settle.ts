// "Split the trip bill": everyone logs what they paid (an expense log), optionally for only some people,
// and the room sees the balances and who transfers what to whom. The host can add a bank account so each
// debtor gets a VietQR; that account is typed in the app, never part of this spec. Used as a template and
// as a conformance fixture.
import type { AppSpecDraft } from "./app-spec-schema";

const noOpts = { options: null, multi: null, capacity: null, min: null, max: null, unit: null };

function tripSettle(t: { title: string; description: string; block: string; note: string; amount: string; what: string; who: string; view: string }, locale: "vi" | "en"): AppSpecDraft {
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
        id: "expenses",
        title: t.block,
        note: t.note,
        entries: "many",
        inputs: [
          { id: "amount", kind: "number", label: t.amount, required: true, ...noOpts, min: 0, unit: "đ" },
          { id: "what", kind: "text", label: t.what, required: false, ...noOpts },
          { id: "who", kind: "person", label: t.who, required: false, ...noOpts, multi: true },
        ],
        views: [{ id: "settle", kind: "settle", title: t.view, source: "amount", op: null, topN: null, visibleTo: "everyone" }],
      },
    ],
  };
}

export const exampleSettleTrip: AppSpecDraft = tripSettle(
  {
    title: "Chia tiền chuyến đi",
    description: "Ghi từng khoản đã chi; app tính ai cần chuyển bao nhiêu cho ai.",
    block: "Các khoản đã chi",
    note: "Mỗi khoản chia đều cho mọi người, hoặc chỉ cho những người bạn chọn.",
    amount: "Số tiền",
    what: "Chi cho việc gì",
    who: "Chia cho",
    view: "Ai nợ ai",
  },
  "vi",
);

export const exampleSettleTripEn: AppSpecDraft = tripSettle(
  {
    title: "Split the trip bill",
    description: "Log each expense; the app works out who transfers how much to whom.",
    block: "Expenses",
    note: "Each expense is split among everyone, or only among the people you pick.",
    amount: "Amount",
    what: "What for",
    who: "Split among",
    view: "Who owes whom",
  },
  "en",
);
