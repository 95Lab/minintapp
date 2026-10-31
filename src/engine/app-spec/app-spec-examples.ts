// Hero AppSpec drafts (vote, quiz, milk-tea order, draw, word cloud) written with presets. Used as few-shot examples for the
// real generator and as the output of the mock generator in the UI prototype.
import type { AppSpecDraft } from "./app-spec-schema";

export const exampleWorkshopVote: AppSpecDraft = {
  specVersion: 1,
  locale: "vi",
  title: "Chọn chủ đề workshop chiều nay",
  description: "Mỗi người một phiếu, kết quả hiện trực tiếp.",
  theme: "ink",
  requireName: false,
  blocks: [
    {
      type: "choice",
      id: "topic",
      question: "Bạn muốn nghe chủ đề nào nhất?",
      options: [
        { id: "ai-agent", label: "AI agent" },
        { id: "bao-mat", label: "Bảo mật" },
        { id: "du-lieu", label: "Dữ liệu" },
        { id: "ux", label: "UX" },
      ],
      multi: false,
      showResults: "live",
    },
  ],
};

export const examplePasswordQuiz: AppSpecDraft = {
  specVersion: 1,
  locale: "vi",
  title: "Quiz nhanh: an toàn mật khẩu",
  description: "3 câu, 20 giây mỗi câu, có bảng xếp hạng.",
  theme: "sunset",
  requireName: true,
  blocks: [
    {
      type: "quiz",
      id: "quiz",
      leaderboard: true,
      questions: [
        {
          id: "q1",
          prompt: "Mật khẩu nào mạnh nhất?",
          options: [
            { id: "a", label: "123456789" },
            { id: "b", label: "HoangThuc2024" },
            { id: "c", label: "ca-phe-sua-da-3-muong-duong" },
            { id: "d", label: "P@ssw0rd" },
          ],
          correct: "c",
          points: 100,
          timeLimitSec: 20,
        },
        {
          id: "q2",
          prompt: "Bật xác thực 2 lớp (2FA) giúp gì?",
          options: [
            { id: "a", label: "Máy chạy nhanh hơn" },
            { id: "b", label: "Lộ mật khẩu vẫn khó bị chiếm tài khoản" },
            { id: "c", label: "Không cần mật khẩu nữa" },
          ],
          correct: "b",
          points: 100,
          timeLimitSec: 20,
        },
        {
          id: "q3",
          prompt: "Nhận SMS yêu cầu đọc mã OTP cho \"nhân viên ngân hàng\", bạn làm gì?",
          options: [
            { id: "a", label: "Đọc mã cho nhanh" },
            { id: "b", label: "Không đưa, gọi tổng đài chính thức" },
            { id: "c", label: "Gửi một nửa mã" },
          ],
          correct: "b",
          points: 100,
          timeLimitSec: 20,
        },
      ],
    },
  ],
};

export const exampleMilkTeaOrder: AppSpecDraft = {
  specVersion: 1,
  locale: "vi",
  title: "Gom đơn trà sữa chiều thứ Sáu",
  description: "Chốt đơn lúc 15:00. Mỗi người một đơn, sửa được.",
  theme: "forest",
  requireName: true,
  blocks: [
    {
      type: "collect",
      id: "order",
      title: "Đơn của bạn",
      aggregate: "sum_price",
      fields: [
        {
          id: "drink",
          label: "Món",
          kind: "select",
          options: [
            { label: "Trà sữa trân châu", unitPrice: 35000 },
            { label: "Trà đào cam sả", unitPrice: 40000 },
            { label: "Matcha latte", unitPrice: 45000 },
          ],
        },
        {
          id: "size",
          label: "Size",
          kind: "select",
          options: [
            { label: "M", unitPrice: null },
            { label: "L (+5.000đ)", unitPrice: 5000 },
          ],
        },
        { id: "qty", label: "Số lượng", kind: "number", options: null },
        { id: "note", label: "Ghi chú (ít đá, ít ngọt…)", kind: "short_text", options: null },
      ],
    },
  ],
};

export const exampleClassDraw: AppSpecDraft = {
  specVersion: 1,
  locale: "vi",
  title: "Bốc thăm người trả lời",
  description: "Bấm \"Tham gia\" để vào vòng quay. Mỗi người chỉ trúng một lần.",
  theme: "sunset",
  requireName: true,
  blocks: [{ type: "wheel", id: "draw", title: "Ai lên bảng?", source: "participants", options: [], removeWinner: true }],
};

export const exampleOneWordCloud: AppSpecDraft = {
  specVersion: 1,
  locale: "vi",
  title: "Một từ về buổi học hôm nay",
  description: "Gõ 1 từ, cả lớp cùng xem word cloud.",
  theme: "ocean",
  requireName: false,
  blocks: [{ type: "open_text", id: "feeling", question: "Một từ mô tả buổi học hôm nay?", maxWords: 1, showResults: "live" }],
};

export const heroExamples = [exampleWorkshopVote, examplePasswordQuiz, exampleMilkTeaOrder];
