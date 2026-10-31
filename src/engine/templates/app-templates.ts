// Ready-made apps: opening one creates the app instantly (no LLM call), then the host can remix it
// in words. Each template ships a VI and an EN spec. Adding a template = one entry below
// (validated against AppSpecSchema by tests/unit/app-templates.test.ts).
import type { AppSpecDraft } from "@/engine/app-spec/app-spec-schema";
import { COMPOSE_TEMPLATES } from "./app-templates-compose";
import { CUSTOM_TEMPLATES } from "./app-templates-custom";
import { LIVE_TEMPLATES } from "./app-templates-live";
import { exampleClassDraw, exampleMilkTeaOrder, exampleOneWordCloud, examplePasswordQuiz, exampleWorkshopVote } from "@/engine/app-spec/app-spec-examples";

export interface AppTemplate {
  id: string;
  /** brick type shown as a tag */
  kind: string;
  title: { vi: string; en: string };
  blurb: { vi: string; en: string };
  spec: { vi: AppSpecDraft; en: AppSpecDraft };
}

const en = <T extends AppSpecDraft>(base: T, patch: Partial<AppSpecDraft>): AppSpecDraft => ({ ...structuredClone(base), locale: "en", ...patch });

export const APP_TEMPLATES: AppTemplate[] = [
  {
    id: "workshop-vote",
    kind: "choice",
    title: { vi: "Vote chủ đề", en: "Topic poll" },
    blurb: { vi: "4 lựa chọn, mỗi người 1 phiếu, kết quả live", en: "4 options, one vote each, live results" },
    spec: {
      vi: exampleWorkshopVote,
      en: en(exampleWorkshopVote, {
        title: "Pick this afternoon's workshop topic",
        description: "One vote each, live results.",
        blocks: [
          {
            type: "choice",
            id: "topic",
            question: "Which topic do you want most?",
            options: [
              { id: "ai-agent", label: "AI agents" },
              { id: "security", label: "Security" },
              { id: "data", label: "Data" },
              { id: "ux", label: "UX" },
            ],
            multi: false,
            showResults: "live",
          },
        ],
      }),
    },
  },
  {
    id: "quick-quiz",
    kind: "quiz",
    title: { vi: "Quiz nhanh", en: "Quick quiz" },
    blurb: { vi: "3 câu, 20 giây, bảng xếp hạng", en: "3 questions, 20 s, leaderboard" },
    spec: {
      vi: examplePasswordQuiz,
      en: en(examplePasswordQuiz, {
        title: "Quick quiz: password safety",
        description: "3 questions, 20 seconds each, leaderboard.",
        blocks: [
          {
            type: "quiz",
            id: "quiz",
            leaderboard: true,
            questions: [
              { id: "q1", prompt: "Which password is strongest?", options: [{ id: "a", label: "123456789" }, { id: "b", label: "John2024" }, { id: "c", label: "coffee-rain-lamp-42" }, { id: "d", label: "P@ssw0rd" }], correct: "c", points: 100, timeLimitSec: 20 },
              { id: "q2", prompt: "What does two-factor authentication (2FA) do?", options: [{ id: "a", label: "Makes the device faster" }, { id: "b", label: "Protects the account even if the password leaks" }, { id: "c", label: "Removes the need for passwords" }], correct: "b", points: 100, timeLimitSec: 20 },
              { id: "q3", prompt: "A text asks you to read your OTP to a \"bank agent\". You…", options: [{ id: "a", label: "Read it quickly" }, { id: "b", label: "Refuse and call the official hotline" }, { id: "c", label: "Send half of it" }], correct: "b", points: 100, timeLimitSec: 20 },
            ],
          },
        ],
      }),
    },
  },
  {
    id: "milk-tea-order",
    kind: "collect",
    title: { vi: "Gom đơn trà sữa", en: "Group drink order" },
    blurb: { vi: "Chọn món, size, tự cộng tổng tiền", en: "Pick drink & size, totals added up" },
    spec: {
      vi: exampleMilkTeaOrder,
      en: en(exampleMilkTeaOrder, {
        title: "Friday drink order",
        description: "Order closes at 3 pm. One order each, editable.",
        blocks: [
          {
            type: "collect",
            id: "order",
            title: "Your order",
            aggregate: "sum_price",
            fields: [
              { id: "drink", label: "Drink", kind: "select", options: [{ label: "Milk tea", unitPrice: 35000 }, { label: "Peach tea", unitPrice: 40000 }, { label: "Matcha latte", unitPrice: 45000 }] },
              { id: "size", label: "Size", kind: "select", options: [{ label: "M", unitPrice: null }, { label: "L (+5,000)", unitPrice: 5000 }] },
              { id: "qty", label: "Quantity", kind: "number", options: null },
              { id: "note", label: "Note (less ice, less sugar…)", kind: "short_text", options: null },
            ],
          },
        ],
      }),
    },
  },
  {
    id: "class-draw",
    kind: "wheel",
    title: { vi: "Bốc thăm người trả lời", en: "Random student picker" },
    blurb: { vi: "Mọi người bấm tham gia, host quay, không trùng", en: "Everyone joins, host spins, no repeats" },
    spec: {
      vi: exampleClassDraw,
      en: en(exampleClassDraw, {
        title: "Who answers next?",
        description: "Tap \"Join\" to get on the wheel. Each person is picked once.",
        blocks: [{ type: "wheel", id: "draw", title: "Who's up?", source: "participants", options: [], removeWinner: true }],
      }),
    },
  },
  {
    id: "prize-wheel",
    kind: "wheel",
    title: { vi: "Vòng quay giải thưởng", en: "Prize wheel" },
    blurb: { vi: "Danh sách giải cố định, quay trên máy chiếu", en: "Fixed prize list, spun on the projector" },
    spec: {
      vi: {
        ...structuredClone(exampleClassDraw),
        title: "Vòng quay may mắn",
        description: "Host bấm Quay, cả phòng cùng xem kết quả.",
        requireName: false,
        blocks: [
          {
            type: "wheel",
            id: "prizes",
            title: "Vòng quay may mắn",
            source: "options",
            options: [
              { id: "ao", label: "Áo thun" },
              { id: "non", label: "Nón" },
              { id: "sticker", label: "Sticker" },
              { id: "voucher", label: "Voucher 50k" },
              { id: "chuc", label: "Chúc may mắn lần sau" },
              { id: "sach", label: "Sổ tay" },
            ],
            removeWinner: false,
          },
        ],
      },
      en: en(exampleClassDraw, {
        title: "Lucky wheel",
        description: "The host spins; everyone sees the result.",
        requireName: false,
        blocks: [
          {
            type: "wheel",
            id: "prizes",
            title: "Lucky wheel",
            source: "options",
            options: [
              { id: "tshirt", label: "T-shirt" },
              { id: "cap", label: "Cap" },
              { id: "sticker", label: "Sticker" },
              { id: "voucher", label: "Voucher" },
              { id: "next", label: "Better luck next time" },
              { id: "notebook", label: "Notebook" },
            ],
            removeWinner: false,
          },
        ],
      }),
    },
  },
  {
    id: "one-word-cloud",
    kind: "open_text",
    title: { vi: "Word cloud một từ", en: "One-word cloud" },
    blurb: { vi: "Mỗi người 1 từ, hiện đám mây chữ", en: "One word each, live word cloud" },
    spec: {
      vi: exampleOneWordCloud,
      en: en(exampleOneWordCloud, {
        title: "One word about today's session",
        description: "Type one word; the room sees the cloud.",
        blocks: [{ type: "open_text", id: "feeling", question: "One word to describe today's session?", maxWords: 1, showResults: "live" }],
      }),
    },
  },
];

APP_TEMPLATES.push(...COMPOSE_TEMPLATES, ...CUSTOM_TEMPLATES, ...LIVE_TEMPLATES);

export function findTemplate(id: string): AppTemplate | undefined {
  return APP_TEMPLATES.find((t) => t.id === id);
}
