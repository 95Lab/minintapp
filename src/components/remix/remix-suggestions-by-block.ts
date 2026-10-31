import type { BlockType } from "@/lib/blocks/block-registry";
export const REMIX_SUGGESTIONS: Record<BlockType, readonly string[]> = {
  compose: ["Thêm phần đánh giá mức độ hài lòng", "Tạo quiz từ chủ đề này"],
  quiz: ["Tạo thêm câu hỏi khó hơn", "Tạo bình chọn về chủ đề này"],
  wheel: ["Tạo bình chọn cho các lựa chọn này", "Tạo quiz cho sự kiện"],
};
