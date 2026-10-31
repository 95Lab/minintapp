# Tạo app bằng OpenAI

Luồng đầy đủ: trang chủ hoặc `/templates` → `/api/engine/generate` → OpenAI Responses Structured Outputs → kiểm tra Zod và giới hạn runtime → lưu snapshot → `/rooms/:id/host`.

Chỉ OpenAI, không chuyển ngầm sang provider hoặc dữ liệu giả khi thiếu key. Template có sẵn được tạo trực tiếp từ spec đã kiểm tra và không cần gọi AI. SDK chỉ ở server, `store:false`, deadline dùng chung cho lượt gọi và sửa output có giới hạn. Moderation và phishing scan bảo vệ prompt/spec; không trả lỗi thô hoặc thông tin xác thực cho client.

Homepage nhận JSON và cookie host HttpOnly. Giao diện đầy đủ hỗ trợ stream NDJSON tiến độ và đổi host token sang cookie qua endpoint cùng origin. Remix nhận spec và kết quả tổng hợp, tạo phòng con rồi chuyển participant sang phòng mới. API `/api/generate` cũ vẫn giữ tương thích.

Biến cấu hình: `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_REASONING_EFFORT`, `GENERATION_DEADLINE_MS`. Runtime đầy đủ dùng rate limit chung trong Supabase; API generation cũ vẫn có ngân sách process. Không xem rate limit là giới hạn chi phí tài khoản OpenAI.

Kiểm thử unit/E2E giả lập AI để không phát sinh phí. Chưa gọi generate/remix thật trong lần port này; model/quota, latency và chất lượng nội dung cần xác nhận riêng với key của môi trường triển khai. Xem `full-runtime.md`.
