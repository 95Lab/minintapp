# Tạo app bằng OpenAI

Luồng đầy đủ: trang chủ hoặc `/templates` → `/api/engine/generate` → OpenAI Responses Structured Outputs → kiểm tra Zod và giới hạn runtime → lưu snapshot → `/rooms/:id/host`.

Chỉ OpenAI, không chuyển ngầm sang provider hoặc dữ liệu giả khi thiếu key. Template có sẵn được tạo trực tiếp từ spec đã kiểm tra và không cần gọi AI. SDK chỉ ở server, `store:false`, deadline dùng chung cho lượt gọi và sửa output có giới hạn. Moderation và phishing scan bảo vệ prompt/spec; không trả lỗi thô hoặc thông tin xác thực cho client.

Homepage nhận JSON và cookie host HttpOnly. Giao diện đầy đủ hỗ trợ stream NDJSON tiến độ và đổi host token sang cookie qua endpoint cùng origin. Remix nhận spec và kết quả tổng hợp, tạo phòng con rồi chuyển participant sang phòng mới. API `/api/generate` cũ vẫn giữ tương thích.

Biến cấu hình: `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_REASONING_EFFORT`, `GENERATION_DEADLINE_MS`. Runtime đầy đủ dùng rate limit chung trong Supabase; API generation cũ vẫn có ngân sách process. Không xem rate limit là giới hạn chi phí tài khoản OpenAI.

Kiểm thử unit/E2E giả lập AI để không phát sinh phí. Chưa gọi generate/remix thật trong lần port này; model/quota, latency và chất lượng nội dung cần xác nhận riêng với key của môi trường triển khai. Xem `full-runtime.md`.

## Chat để chốt yêu cầu trên trang chủ

Nút “Trao đổi ý tưởng” mở dialog chat với OpenAI qua `POST /api/engine/plan`. Planner đọc toàn bộ hội thoại và bản yêu cầu hiện tại, hỏi tiếp theo ngữ cảnh, đề xuất tối đa ba câu trả lời nhanh, hoặc chuyển ngay sang `ready` nếu mô tả đã đủ rõ. Planner phải nêu giả định, xử lý yêu cầu mâu thuẫn và đề xuất phạm vi thay thế khi capability chưa hỗ trợ. Các hướng dẫn này định hướng model; chưa có AI eval hoặc bằng chứng model thật luôn tuân thủ.

Contract Zod ở `src/lib/api/planning-contract.ts`: request gồm locale, messages user/assistant xen kẽ và currentBrief; response có status `clarify | ready | unsupported`, message, suggestions, brief. Tối đa 25 messages, tổng 5.000 ký tự, mỗi message 1.600 ký tự; body tối đa 16 KiB. Bản yêu cầu tối đa 500 ký tự để giữ contract generation hiện có. Không âm thầm cắt lịch sử/nội dung; vượt giới hạn cần bắt đầu lại với mô tả gọn hơn.

Route dùng SDK OpenAI phía server với Responses Structured Outputs, model/config hiện có, `store: false`, deadline và không fallback mock. Same-origin, rate limit riêng `plan` (30 lượt/10 phút/IP) và ngân sách generation theo process được kiểm tra trước khi gọi AI. Planner chỉ trả nội dung, không lưu app, tạo deployment hoặc cấp token host. Không ghi hội thoại vào log. Hội thoại giữ trong bộ nhớ component, đóng/mở lại dialog tiếp tục chat; tải lại trang sẽ mất.

Chỉ nút “Chốt yêu cầu và tạo app” mới gọi luồng generation hiện có với bản brief cuối và lifetime. Tin nhắn “ok” không tự tạo app. Nút khóa khi chưa ready, đang xử lý, có tin nhắn chưa gửi hoặc lượt sửa gần nhất thất bại. Lỗi tạo app giữ brief để thử lại. Xác nhận này là bước UX, không phải cơ chế phân quyền/bắt buộc ở API generation; API cũ và template giữ tương thích. Composer engine độc lập vẫn giữ luồng hiện có.

Unit test dùng SDK parser thật với HTTP giả lập; E2E giả lập planner/generation để kiểm tra hội thoại và thời điểm gọi tạo app. Chưa gọi OpenAI thật hoặc kiểm tra Supabase thật trong các test này.
