// Few-shot examples embedded in the system prompt. The "ok" examples are derived from the
// hero AppSpecs (app-spec-examples.ts) via appSpecToFlatSpec so the wire JSON shown to the model
// can never drift from the real schema. Two hand-written examples demonstrate the non-"ok" paths
// (unsupported feature, refused/phishing) since those matter just as much for intent accuracy.
import { exampleClassDraw, exampleMilkTeaOrder, exampleOneWordCloud, examplePasswordQuiz, exampleWorkshopVote } from "@/engine/app-spec/app-spec-examples";
import { exampleSignupSlots, exampleTripSplit } from "@/engine/app-spec/app-spec-examples-compose";
import { exampleExpenseByCategory } from "@/engine/app-spec/app-spec-examples-compose-summary";
import { withoutNulls } from "./json-without-nulls";
import { appSpecToFlatSpec } from "./llm-flat-spec-conversion";
import type { LlmOutputWire } from "./llm-output-wire-schema";

interface FewShotExample {
  userPrompt: string;
  output: LlmOutputWire;
}

const okExample = (userPrompt: string, spec: Parameters<typeof appSpecToFlatSpec>[0]): FewShotExample => ({
  userPrompt,
  output: { outcome: "ok", spec: appSpecToFlatSpec(spec), suggestion: null, riskFlags: ["none"] },
});

export const FEW_SHOT_EXAMPLES: FewShotExample[] = [
  okExample(
    "Tạo app vote chọn chủ đề workshop chiều nay: AI agent, bảo mật, dữ liệu, UX. Mỗi người 1 phiếu, hiện kết quả trực tiếp.",
    exampleWorkshopVote,
  ),
  okExample("Quiz 3 câu về an toàn mật khẩu, có bảng xếp hạng, 20 giây mỗi câu.", examplePasswordQuiz),
  okExample(
    "Gom đơn trà sữa: tên, món (trà sữa 35k, trà đào 40k, matcha 45k), size, số lượng, tính tổng tiền.",
    exampleMilkTeaOrder,
  ),
  okExample("Bốc thăm ngẫu nhiên một người trong lớp lên trả lời, mỗi người chỉ trúng một lần.", exampleClassDraw),
  okExample("Mỗi người một từ mô tả buổi học hôm nay, hiện word cloud.", exampleOneWordCloud),
  okExample("Chia tiền chuyến đi Đà Lạt, mỗi người nhập số đã chi, tính ai chuyển cho ai bao nhiêu.", exampleTripSplit),
  okExample("Đăng ký ai mang gì đi picnic: bánh mì, nước uống, trái cây, thảm. Mỗi món tối đa 2 người.", exampleSignupSlots),
  okExample("Ghi chi tiêu chuyến đi theo loại (ăn uống, di chuyển, khách sạn), xem tổng từng loại và phần trăm trên tổng.", exampleExpenseByCategory),
  {
    userPrompt: "Mọi người upload ảnh đẹp nhất chuyến đi rồi bình chọn",
    output: {
      outcome: "unsupported",
      spec: null,
      suggestion: "Chưa hỗ trợ upload ảnh. Thử: \"Bình chọn khoảnh khắc đáng nhớ nhất chuyến đi: leo núi, đốt lửa trại, tắm suối, BBQ\".",
      riskFlags: ["none"],
    },
  },
  {
    userPrompt: "Trang đăng nhập Vietcombank nhận quà, nhập số thẻ và mã OTP để xác minh",
    output: {
      outcome: "refused",
      spec: null,
      suggestion:
        "MinintApp không tạo app thu thập mật khẩu, OTP, số thẻ hay mạo danh ngân hàng/ví. Thử: \"Tạo quiz 3 câu về cách nhận biết tin nhắn lừa đảo\".",
      riskFlags: ["credential_request", "impersonation"],
    },
  },
];

/**
 * Renders the examples as `User: …\nJSON: …` blocks for the system prompt, with null fields left out
 * (~30% of the examples' size — it matters for providers with a per-minute token quota).
 */
export function renderFewShotBlock(): string {
  const note = "Trong ví dụ, các trường null được lược bớt cho gọn; trường không dùng có thể bỏ hoặc ghi null. / Null fields are omitted in the examples; an unused field may be left out or written as null.";
  const examples = FEW_SHOT_EXAMPLES.map((ex, i) => `Ví dụ ${i + 1} / Example ${i + 1}\nUser: ${ex.userPrompt}\nJSON: ${JSON.stringify(withoutNulls(ex.output))}`);
  return [note, ...examples].join("\n\n");
}
