# Tạo app bằng OpenAI

Luồng đã nối: prompt ở trang chủ → POST /api/generate → OpenAI Structured Outputs → validate khả năng chạy → repair tối đa một lần → lưu memory → cookie host → mở /a/:id/host. Share QR/link và runtime participant dùng các API hiện có. Không có mock fallback trong production.

## Cấu hình

Trong `.env.local` hoặc file môi trường runtime trên server:

```dotenv
OPENAI_API_KEY=your-key
OPENAI_MODEL=gpt-5-mini
OPENAI_REASONING_EFFORT=low
GENERATION_DEADLINE_MS=18000
GENERATION_MAX_PER_HOUR=30
GENERATION_MAX_CONCURRENT=2
```

Không dùng tiền tố NEXT_PUBLIC_ cho key. Giữ key thật ngoài Git; chạy `npm run env:check` và restart server sau khi đổi cấu hình. Model phải hỗ trợ Responses Structured Outputs; nếu không hỗ trợ reasoning, đặt OPENAI_REASONING_EFFORT rỗng. Tên model mặc định được giữ từ cấu hình dự án, chưa được xác nhận quyền truy cập trên tài khoản của bạn.

Nếu không có key, API trả 503 với mã ai_not_configured và UI hiển thị rõ; các mẫu có sẵn vẫn hoạt động không cần key. Cấu hình hạn mức generation được đọc từ server, không cho client chọn.

## Phạm vi output

- Compose: một input choice bắt buộc, chọn một option, 2–20 options, các trường không dùng là null. Một đến bốn bars view có source trỏ đúng input; visibility everyone/after_submit/after_close/host.
- Quiz: schema lõi đã có, id câu hỏi duy nhất toàn app, đáp án tham chiếu option có thật. Host điều khiển open/reveal; timeLimitSec chỉ là thời lượng gợi ý.
- Wheel: fixed options hoặc participants; participants yêu cầu tên. Server chọn winner và giữ trạng thái loại trừ.

Tối đa sáu block. Chưa sinh form text/number, rating, slot, steps, nhiều dòng, biểu thức, payments, chat, upload, map, live/custom. Compose runtime đã hỗ trợ các form, thống kê, steps, nhiều dòng và query qua template/spec; generation wire schema vẫn hẹp hơn và route từ chối output ngoài phạm vi này.

Id đặc biệt __proto__/constructor/prototype bị từ chối để không dùng làm key runtime. Plain text có HTML hoặc URL bị từ chối; đây chỉ là kiểm tra nội dung cơ bản, chưa thay thế moderation/chống phishing hoặc đánh giá đúng ý định.

## Repair, deadline và giới hạn

SDK dùng responses.parse với zodTextFormat, store=false, max_output_tokens=6000, maxRetries=0. Sau khi có output đầy đủ, schema local kiểm tra ràng buộc nghiệp vụ. Output sai hoặc lỗi JSON/schema được sinh lại tối đa một lần, kèm feedback validation; không dùng sửa chuỗi bằng regex. Refusal, incomplete, quota và lỗi mạng không kích hoạt repair. Cả hai lượt dùng chung một deadline và tín hiệu hủy của request. Xem [Structured Outputs — OpenAI Docs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).

Budget hiện là toàn process: mặc định 30 request trong cửa sổ một giờ và tối đa hai request đang chạy. Mỗi request có thể gọi OpenAI hai lần; quota request không phải quota token/tiền. Restart xóa budget cùng dữ liệu memory. Cần bổ sung hạn mức bền và rate limit theo người dùng/IP khi triển khai nhiều process.

Response API là JSON một lần sau khi lưu thành công để đặt được cookie host HttpOnly, không stream NDJSON. UI có trạng thái đang chờ và thông báo lỗi, không giả lập stage nội bộ provider. Host token không được đưa vào URL/localStorage hoặc link participant.

## Kiểm thử và giới hạn xác minh

Unit test dùng mock provider, cùng một integration test chạy SDK parser thực trên HTTP response giả lập qua route và repository. Kiểm tra schema, unsupported output, repair, deadline/cancellation, missing key, refusal, quota/concurrency và không lưu output sai.

E2E generate mock HTTP endpoint nhưng tạo app/cookie qua API thật và thử participant vote; kiểm tra giữ prompt và mở lại submit khi API lỗi. Không gọi OpenAI thật trong CI. Trong lần triển khai này chưa có key ở môi trường local nên chưa xác nhận model, quota, latency hay độ đúng ý định với dịch vụ thật.

App tạo thành công vẫn lưu trong memory, mất khi restart; chưa có Supabase hoặc remix theo dữ liệu.
