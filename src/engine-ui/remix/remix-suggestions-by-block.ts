// One-tap remix ideas shown under the remix box, chosen from what the app's first block actually
// looks like — polls, word clouds and group orders are all compose blocks at runtime, so the shape
// (not the type) decides which ideas make sense.
import type { PublicBlock } from "@/engine/app-spec/strip-private-fields";
import type { UiLocale } from "@/engine/i18n/ui-strings-vi-en";

type Shape = "poll" | "cloud" | "order" | "compose" | "quiz" | "wheel" | "custom" | "live";

const SUGGESTIONS: Record<Shape, Record<UiLocale, string[]>> = {
  poll: {
    vi: ["Đổi thành quiz 3 câu về chủ đề vừa thắng, có bảng xếp hạng", "Thêm lựa chọn: Cloud", "Ẩn kết quả tới khi đóng"],
    en: ["Turn this into a 3-question quiz about the winning topic", "Add option: Cloud", "Hide results until closed"],
  },
  quiz: {
    vi: ["Thêm 2 câu khó hơn", "Đổi thời gian mỗi câu thành 30 giây", "Đổi thành vote chọn chủ đề quiz tiếp theo"],
    en: ["Add 2 harder questions", "Make it 30 seconds per question", "Turn into a poll for the next quiz topic"],
  },
  order: {
    vi: ["Thêm món: trà chanh 25k", "Thêm ô ghi chú (ít đá, ít đường)", "Bỏ ô số lượng"],
    en: ["Add item: lemon tea 25k", "Add a notes field (less ice, less sugar)", "Remove the quantity field"],
  },
  wheel: {
    vi: ["Mỗi người chỉ trúng một lần", "Đổi thành quay giải: áo, nón, sticker, voucher", "Chuyển sang bốc thăm người tham gia"],
    en: ["Each person can win only once", "Make it a prize wheel: shirt, cap, sticker, voucher", "Switch to drawing participants"],
  },
  custom: {
    vi: ["Làm trò chơi dễ hơn", "Thêm bảng xếp hạng top 5", "Đổi màu nền sáng hơn"],
    en: ["Make the game easier", "Add a top-5 leaderboard", "Use a lighter background"],
  },
  live: {
    vi: ["Đổi sang tỷ giá USD sang VND", "Đổi sang thời tiết Hà Nội", "Thêm bình chọn kế hoạch"],
    en: ["Switch to the USD to VND rate", "Switch to Hanoi weather", "Add a poll for the plan"],
  },
  cloud: {
    vi: ["Cho phép tối đa 3 từ", "Ẩn word cloud tới khi đóng", "Đổi thành vote giữa 4 ý được nhắc nhiều nhất"],
    en: ["Allow up to 3 words", "Hide the cloud until closed", "Turn the top 4 answers into a poll"],
  },
  compose: {
    vi: ["Thêm ô chấm sao 1–5", "Thêm bảng xếp hạng", "Chỉ host xem bảng chi tiết"],
    en: ["Add a 1–5 star rating", "Add a leaderboard", "Only the host sees the detail table"],
  },
};

function shapeOf(block: PublicBlock): Shape {
  if (block.type !== "compose") return block.type;
  if (block.views.some((v) => v.kind === "orders")) return "order";
  const [only] = block.inputs;
  if (block.inputs.length === 1 && only.kind === "choice" && block.views.some((v) => v.kind === "bars")) return "poll";
  if (block.inputs.length === 1 && only.kind === "text" && block.views.some((v) => v.kind === "cloud")) return "cloud";
  return "compose";
}

export function remixSuggestions(block: PublicBlock | undefined, locale: UiLocale): string[] {
  return SUGGESTIONS[block ? shapeOf(block) : "compose"][locale];
}
