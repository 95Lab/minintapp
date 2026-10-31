# Tạo app bằng OpenAI

Luồng đầy đủ: trang chủ hoặc `/templates` → `/api/engine/generate` → OpenAI Responses Structured Outputs → kiểm tra Zod và giới hạn runtime → lưu snapshot → `/rooms/:id/host`.

Chỉ OpenAI, không chuyển ngầm sang provider hoặc dữ liệu giả khi thiếu key. Template có sẵn được tạo trực tiếp từ spec đã kiểm tra và không cần gọi AI. SDK chỉ ở server, `store:false`, deadline dùng chung cho lượt gọi và sửa output có giới hạn. Moderation và phishing scan bảo vệ prompt/spec; không trả lỗi thô hoặc thông tin xác thực cho client.

Homepage nhận JSON và cookie host HttpOnly. Giao diện đầy đủ hỗ trợ stream NDJSON tiến độ và đổi host token sang cookie qua endpoint cùng origin. Remix nhận spec và kết quả tổng hợp, tạo phòng con rồi chuyển participant sang phòng mới. API `/api/generate` cũ vẫn giữ tương thích.

Biến cấu hình: `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_REASONING_EFFORT`, `GENERATION_DEADLINE_MS`. Runtime đầy đủ dùng rate limit chung trong Supabase; API generation cũ vẫn có ngân sách process. Không xem rate limit là giới hạn chi phí tài khoản OpenAI.

Kiểm thử unit/E2E giả lập AI để không phát sinh phí. Chưa gọi generate/remix thật trong lần port này; model/quota, latency và chất lượng nội dung cần xác nhận riêng với key của môi trường triển khai. Xem `full-runtime.md`.

## Chốt yêu cầu trên trang chủ

Composer trang chủ có ba bước: ý tưởng, câu hỏi làm rõ (người dùng, tương tác, kết quả/quy tắc), rồi bản yêu cầu có thể chỉnh sửa và chọn thời gian sử dụng. Các câu hỏi hiện cố định, không phải hội thoại AI thích ứng. Có thể bỏ trống phần bổ sung nếu mô tả đã đủ. Không gọi API generation hoặc tạo app trước khi bấm xác nhận ở bước cuối. Bản yêu cầu cuối phải nằm trong giới hạn 500 ký tự của contract hiện có; UI yêu cầu người dùng rút gọn nếu vượt giới hạn, không cắt nội dung âm thầm. Khi tạo lỗi, giữ bản yêu cầu để sửa hoặc thử lại.

Phạm vi này áp dụng cho composer `src/components/create/prompt-composer.tsx` trên trang chủ và preview. Tạo từ template và composer engine độc lập vẫn giữ luồng hiện có. Chưa có planner OpenAI hỏi tiếp theo ngữ cảnh, lưu hội thoại hoặc ràng buộc xác nhận phía API.
