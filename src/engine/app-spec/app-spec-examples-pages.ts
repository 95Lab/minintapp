// Multi-page app: four blocks behind a tab bar (agenda poll, Q&A board, feedback rating, chat) — a whole
// workshop day in one link. Used as a template and as a conformance fixture for `layout: "tabs"`.
import type { AppSpecDraft } from "./app-spec-schema";

const noOpts = { options: null, multi: null, capacity: null, min: null, max: null, unit: null };

interface WorkshopDayText {
  title: string;
  description: string;
  agenda: { question: string; options: [string, string, string] };
  qna: { block: string; question: string; view: string };
  feedback: { block: string; stars: string; comment: string; avg: string };
  chat: { block: string; message: string; view: string };
}

function workshopDay(t: WorkshopDayText, locale: "vi" | "en"): AppSpecDraft {
  const [a, b, c] = t.agenda.options;
  return {
    specVersion: 1,
    locale,
    title: t.title,
    description: t.description,
    theme: "forest",
    requireName: false,
    layout: "tabs",
    blocks: [
      {
        type: "choice",
        id: "agenda",
        question: t.agenda.question,
        options: [
          { id: "ai", label: a },
          { id: "security", label: b },
          { id: "data", label: c },
        ],
        multi: false,
        showResults: "live",
      },
      {
        type: "compose",
        id: "qna",
        title: t.qna.block,
        note: null,
        entries: "many",
        inputs: [{ id: "question", kind: "text", label: t.qna.question, required: true, ...noOpts, max: 40 }],
        views: [{ id: "top", kind: "board", title: t.qna.view, source: "question", op: null, topN: null, visibleTo: "everyone" }],
      },
      {
        type: "compose",
        id: "feedback",
        title: t.feedback.block,
        note: null,
        inputs: [
          { id: "stars", kind: "rating", label: t.feedback.stars, required: true, ...noOpts, max: 5 },
          { id: "comment", kind: "text", label: t.feedback.comment, required: false, ...noOpts },
        ],
        views: [{ id: "avg", kind: "stat", title: t.feedback.avg, source: "stars", op: "avg", topN: null, visibleTo: "everyone" }],
      },
      {
        type: "compose",
        id: "chat",
        title: t.chat.block,
        note: null,
        entries: "many",
        inputs: [{ id: "message", kind: "text", label: t.chat.message, required: true, ...noOpts, max: 30 }],
        views: [{ id: "feed", kind: "chat", title: t.chat.view, source: "message", op: null, topN: null, visibleTo: "everyone" }],
      },
    ],
  };
}

export const exampleWorkshopDay: AppSpecDraft = workshopDay(
  {
    title: "Ngày workshop",
    description: "Chọn chủ đề, hỏi diễn giả, đánh giá và trò chuyện — mỗi việc một tab.",
    agenda: { question: "Chủ đề chiều nay", options: ["AI agent", "Bảo mật", "Dữ liệu"] },
    qna: { block: "Hỏi đáp", question: "Câu hỏi của bạn", view: "Câu hỏi được quan tâm nhất" },
    feedback: { block: "Đánh giá", stars: "Chấm điểm", comment: "Một điều nên cải thiện", avg: "Điểm trung bình" },
    chat: { block: "Trò chuyện", message: "Tin nhắn", view: "Cuộc trò chuyện" },
  },
  "vi",
);

export const exampleWorkshopDayEn: AppSpecDraft = workshopDay(
  {
    title: "Workshop day",
    description: "Pick a topic, ask the speaker, rate the day and chat — one tab each.",
    agenda: { question: "This afternoon's topic", options: ["AI agents", "Security", "Data"] },
    qna: { block: "Q&A", question: "Your question", view: "Most wanted questions" },
    feedback: { block: "Feedback", stars: "Rating", comment: "One thing to improve", avg: "Average rating" },
    chat: { block: "Chat", message: "Message", view: "Conversation" },
  },
  "en",
);
