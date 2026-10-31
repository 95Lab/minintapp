// Keyword-mock builders for compose apps (used when no LLM key is configured): bill split,
// sign-up slots with a seat limit, star rating. They start from the compose examples and patch in
// what the prompt says (list after ":", "tối đa N" / "max N").
import type { AppSpecDraft, Locale } from "@/engine/app-spec/app-spec-schema";
import { exampleSessionRating, exampleSignupSlots, exampleTripSplit } from "@/engine/app-spec/app-spec-examples-compose";

export const SPLIT_INTENT = /(chia tiền|chia tien|split (the )?bill|splitwise|ai nợ ai|who owes)/i;
export const SIGNUP_INTENT = /(đăng ký|dang ky|phân công|phan cong|ai mang gì|chọn ca|sign[- ]?up|slots?\b)/i;
export const RATING_INTENT = /(đánh giá|danh gia|chấm điểm|chấm sao|rating|feedback|rate\b)/i;

const slug = (s: string, i: number) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30) || `opt-${i}`;

function listAfterColon(prompt: string): string[] {
  return (
    prompt
      .match(/:\s*([^.\n]+)/)?.[1]
      .split(/,|;|\/|\s+và\s+|\s+and\s+/i)
      .map((s) => s.replace(/(mỗi|tối đa|max).*$/i, "").trim())
      .filter((s) => s.length > 0 && s.length <= 40) ?? []
  );
}

function compose(spec: AppSpecDraft) {
  const block = spec.blocks[0];
  if (block.type !== "compose") throw new Error("compose example expected");
  return block;
}

export function buildSplit(locale: Locale): AppSpecDraft {
  const spec = structuredClone(exampleTripSplit);
  if (locale === "en") {
    const b = compose(spec);
    Object.assign(spec, { locale, title: "Split the trip bill", description: "Everyone enters what they paid; the app works out who pays whom." });
    Object.assign(b, { title: "How much did you pay?", note: "Paid nothing? Enter 0." });
    b.inputs[0].label = "Amount paid";
    b.inputs[1].label = "What for";
    b.views[0].title = "Who pays whom";
    b.views[1].title = "Details";
  }
  return spec;
}

export function buildSignup(prompt: string, locale: Locale): AppSpecDraft {
  const spec = structuredClone(exampleSignupSlots);
  const b = compose(spec);
  const items = listAfterColon(prompt);
  if (items.length >= 2) b.inputs[0].options = items.slice(0, 20).map((label, i) => ({ id: slug(label, i), label: label.charAt(0).toUpperCase() + label.slice(1), price: null }));
  const cap = Number(prompt.match(/(?:tối đa|toi da|max(?:imum)?)\s*(\d{1,3})/i)?.[1]);
  b.inputs[0].capacity = cap >= 1 && cap <= 500 ? cap : b.inputs[0].capacity;
  if (locale === "en") {
    Object.assign(spec, { locale, title: "Sign-up: who brings what?", description: "Limited seats per item; extra sign-ups go to a waitlist." });
    Object.assign(b, { title: "What will you bring?" });
    b.inputs[0].label = "Pick one";
    b.views[0].title = "Who brings what";
  }
  return spec;
}

export function buildRating(locale: Locale): AppSpecDraft {
  const spec = structuredClone(exampleSessionRating);
  if (locale === "en") {
    const b = compose(spec);
    Object.assign(spec, { locale, title: "Rate the session", description: "Stars and one short suggestion, anonymous." });
    Object.assign(b, { title: "How was today?" });
    b.inputs[0].label = "Your rating";
    b.inputs[1].label = "One thing to improve";
    b.views[0].title = "Average";
    b.views[1].title = "Stars";
    b.views[2].title = "Suggestions";
  }
  return spec;
}
