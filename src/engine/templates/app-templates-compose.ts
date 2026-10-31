// Templates assembled from compose atoms. The EN variants come from the same builders the keyword
// mock uses, so VI/EN stay structurally identical.
import { exampleSessionRating, exampleSignupSlots, exampleTripSplit } from "@/engine/app-spec/app-spec-examples-compose";
import { buildRating, buildSignup, buildSplit } from "@/engine/generation/template-compose-builders";
import { exampleExpenseLog, exampleLeaderVote, exampleRandomTeams, exampleRsvp, exampleStepSurvey } from "@/engine/app-spec/app-spec-examples-compose-advanced";
import { buildExpenseLog, buildLeaderVote, buildRsvp, buildStepSurvey, buildTeams } from "@/engine/generation/template-compose-advanced-builders";
import type { AppTemplate } from "./app-templates";
import { exampleExpenseByCategory, exampleExpenseByCategoryEn } from "@/engine/app-spec/app-spec-examples-compose-summary";
import { exampleQnaBoard, exampleQnaBoardEn } from "@/engine/app-spec/app-spec-examples-compose-board";
import { exampleChatRoom, exampleChatRoomEn } from "@/engine/app-spec/app-spec-examples-compose-chat";
import { exampleWhereFrom, exampleWhereFromEn } from "@/engine/app-spec/app-spec-examples-compose-map";
import { exampleSettleTrip, exampleSettleTripEn } from "@/engine/app-spec/app-spec-examples-compose-settle";
import { examplePhotoContest, examplePhotoContestEn } from "@/engine/app-spec/app-spec-examples-compose-photo";
import { exampleRankedChoice, exampleRankedChoiceEn } from "@/engine/app-spec/app-spec-examples-compose-ranking";
import { exampleBuzzer, exampleBuzzerEn } from "@/engine/app-spec/app-spec-examples-compose-buzzer";
import { exampleWorkshopDay, exampleWorkshopDayEn } from "@/engine/app-spec/app-spec-examples-pages";

export const COMPOSE_TEMPLATES: AppTemplate[] = [
  {
    id: "trip-split",
    kind: "compose",
    title: { vi: "Chia tiền chuyến đi", en: "Split the trip bill" },
    blurb: { vi: "Ai đã chi bao nhiêu → ai chuyển cho ai", en: "Who paid what → who pays whom" },
    spec: { vi: exampleTripSplit, en: buildSplit("en") },
  },
  {
    id: "settle-up",
    kind: "compose",
    title: { vi: "Sổ chi tiêu chia tiền", en: "Expense log & settle up" },
    blurb: { vi: "Ghi từng khoản chi → ai chuyển cho ai, có mã VietQR", en: "Log each expense → who pays whom, with a VietQR option" },
    spec: { vi: exampleSettleTrip, en: exampleSettleTripEn },
  },
  {
    id: "signup-slots",
    kind: "compose",
    title: { vi: "Đăng ký ai mang gì", en: "Who brings what" },
    blurb: { vi: "Giới hạn chỗ mỗi món, hết chỗ vào danh sách chờ", en: "Seat limit per item, then a waitlist" },
    spec: { vi: exampleSignupSlots, en: buildSignup("", "en") },
  },
  {
    id: "session-rating",
    kind: "compose",
    title: { vi: "Đánh giá buổi học", en: "Rate the session" },
    blurb: { vi: "Chấm sao + góp ý, điểm trung bình live", en: "Stars + suggestions, live average" },
    spec: { vi: exampleSessionRating, en: buildRating("en") },
  },
  {
    id: "expense-log",
    kind: "compose",
    title: { vi: "Sổ chi tiêu nhóm", en: "Group expense log" },
    blurb: { vi: "Mỗi khoản một dòng, tự tính ai chuyển ai", en: "One line per expense, auto settle-up" },
    spec: { vi: exampleExpenseLog, en: buildExpenseLog("en") },
  },
  {
    id: "buzzer",
    kind: "compose",
    title: { vi: "Bấm chuông giành quyền", en: "Buzzer" },
    blurb: { vi: "Host mở vòng, ai bấm trước thắng", en: "Host opens a round, first to buzz wins" },
    spec: { vi: exampleBuzzer, en: exampleBuzzerEn },
  },
  {
    id: "ranked-choice",
    kind: "compose",
    title: { vi: "Xếp hạng ưu tiên", en: "Ranked priorities" },
    blurb: { vi: "Mỗi người xếp top 3, tính điểm Borda", en: "Everyone ranks a top 3, Borda points" },
    spec: { vi: exampleRankedChoice, en: exampleRankedChoiceEn },
  },
  {
    id: "photo-contest",
    kind: "compose",
    title: { vi: "Thi ảnh", en: "Photo contest" },
    blurb: { vi: "Gửi ảnh, host duyệt, mọi người thả tim", en: "Post photos, host approves, everyone likes" },
    spec: { vi: examplePhotoContest, en: examplePhotoContestEn },
  },
  {
    id: "qna-board",
    kind: "compose",
    title: { vi: "Hỏi đáp (Q&A)", en: "Q&A board" },
    blurb: { vi: "Gửi câu hỏi, ♥ câu muốn nghe, câu hot lên đầu", en: "Post questions, ♥ the ones you want answered" },
    spec: { vi: exampleQnaBoard, en: exampleQnaBoardEn },
  },
  {
    id: "chat-room",
    kind: "compose",
    title: { vi: "Phòng chat", en: "Chat room" },
    blurb: { vi: "Nhắn tin trực tiếp cho cả phòng", en: "Live chat for the whole room" },
    spec: { vi: exampleChatRoom, en: exampleChatRoomEn },
  },
  {
    id: "where-from",
    kind: "compose",
    title: { vi: "Bạn đến từ đâu?", en: "Where are you from?" },
    blurb: { vi: "Chia sẻ vị trí, cả phòng thấy trên bản đồ", en: "Share a location, the room sees a map" },
    spec: { vi: exampleWhereFrom, en: exampleWhereFromEn },
  },
  {
    id: "expense-by-category",
    kind: "compose",
    title: { vi: "Chi tiêu theo loại", en: "Spending by category" },
    blurb: { vi: "Tổng từng loại + % trên tổng chi", en: "Total per category + share of all spending" },
    spec: { vi: exampleExpenseByCategory, en: exampleExpenseByCategoryEn },
  },
  {
    id: "random-teams",
    kind: "compose",
    title: { vi: "Chia đội ngẫu nhiên", en: "Random teams" },
    blurb: { vi: "Mọi người vào app, host bấm chia đội", en: "Everyone joins, the host deals teams" },
    spec: { vi: exampleRandomTeams, en: buildTeams("", "en") },
  },
  {
    id: "leader-vote",
    kind: "compose",
    title: { vi: "Bầu trưởng nhóm", en: "Vote for a lead" },
    blurb: { vi: "Chọn một người đang có mặt", en: "Pick someone in the room" },
    spec: { vi: exampleLeaderVote, en: buildLeaderVote("en") },
  },
  {
    id: "step-survey",
    kind: "compose",
    title: { vi: "Hỏi nhanh từng câu", en: "One question at a time" },
    blurb: { vi: "Host mở từng câu, 20 giây mỗi câu", en: "Host opens each question, 20s each" },
    spec: { vi: exampleStepSurvey, en: buildStepSurvey("en") },
  },
  {
    id: "rsvp",
    kind: "compose",
    title: { vi: "Xác nhận tham dự", en: "RSVP" },
    blurb: { vi: "Có đi không, ngày nào, mấy người", en: "Coming or not, which day, how many" },
    spec: { vi: exampleRsvp, en: buildRsvp("en") },
  },
  {
    id: "workshop-day",
    kind: "compose",
    title: { vi: "Ngày workshop (nhiều tab)", en: "Workshop day (tabs)" },
    blurb: { vi: "Bình chọn, hỏi đáp, đánh giá, chat — mỗi việc một tab", en: "Topic poll, Q&A, feedback, chat — one tab each" },
    spec: { vi: exampleWorkshopDay, en: exampleWorkshopDayEn },
  },
];
