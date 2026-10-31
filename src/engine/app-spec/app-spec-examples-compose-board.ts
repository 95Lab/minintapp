// Board apps: everyone posts lines, everyone likes other people's lines, most liked rises to the top —
// Slido-style Q&A, "ideas then vote", a wish wall. Used as a template and as a conformance fixture.
import type { AppSpecDraft } from "./app-spec-schema";

const noOpts = { options: null, multi: null, capacity: null, min: null, max: null, unit: null };

function qnaBoard(t: { title: string; description: string; block: string; note: string; question: string; view: string }, locale: "vi" | "en"): AppSpecDraft {
  return {
    specVersion: 1,
    locale,
    title: t.title,
    description: t.description,
    theme: "ocean",
    requireName: false,
    blocks: [
      {
        type: "compose",
        id: "qna",
        title: t.block,
        note: t.note,
        entries: "many",
        inputs: [{ id: "question", kind: "text", label: t.question, required: true, ...noOpts, max: 40 }],
        views: [{ id: "top", kind: "board", title: t.view, source: "question", op: null, topN: null, visibleTo: "everyone" }],
      },
    ],
  };
}

export const exampleQnaBoard: AppSpecDraft = qnaBoard(
  {
    title: "Hỏi đáp với diễn giả",
    description: "Gửi câu hỏi, bấm ♥ câu hỏi bạn cũng muốn nghe; câu nhiều ♥ nhất lên đầu.",
    block: "Đặt câu hỏi",
    note: "Mỗi câu hỏi một dòng, gửi bao nhiêu cũng được.",
    question: "Câu hỏi của bạn",
    view: "Câu hỏi được quan tâm nhất",
  },
  "vi",
);

export const exampleQnaBoardEn: AppSpecDraft = qnaBoard(
  {
    title: "Ask the speaker",
    description: "Post questions and ♥ the ones you want answered too; the most liked rise to the top.",
    block: "Ask a question",
    note: "One question per line, as many as you like.",
    question: "Your question",
    view: "Most wanted questions",
  },
  "en",
);
