import { AppSpecSchema } from "./app-spec-schema";
export const quizSpec = () => AppSpecSchema.parse({
  specVersion: 1, locale: "vi", title: "Quiz mẫu", description: null, theme: "forest", requireName: false, layout: "stack",
  blocks: [{ type: "quiz", id: "quiz-1", leaderboard: true, questions: [{
    id: "q1", prompt: "Một cộng một bằng?", options: [{ id: "a", label: "Hai" }, { id: "b", label: "Ba" }],
    correct: "a", points: 100, timeLimitSec: 20,
  }] }],
});
export const composeSpec = () => AppSpecSchema.parse({
  ...quizSpec(), title: "Bình chọn", blocks: [{
    id: "poll", type: "compose", title: "Chọn đồ uống", note: null, entries: "one", flow: "open",
    inputs: [{ id: "drink", kind: "choice", label: "Đồ uống", required: true,
      options: [{ id: "tea", label: "Trà", price: null }, { id: "coffee", label: "Cà phê", price: null }],
      multi: false, capacity: null, min: null, max: null, unit: null, showIf: null, timeLimitSec: null }],
    views: [{ id: "results", kind: "bars", title: null, source: "drink", op: null, topN: null, teams: null, query: null, visibleTo: "everyone" }],
  }],
});
