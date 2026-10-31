# Flow app độc lập

Trong cấu hình `PLATFORM_ROLE=control`, tất cả loại app thuộc engine dùng cùng pipeline độc lập: compose (form, bình chọn, chat, ảnh, chia tiền…), quiz, wheel, custom và live. Không giới hạn ở prototype `poll-v1`. `PLATFORM_ROLE=standalone` vẫn là chế độ phát triển chạy chung; không tự giả lập deployment thành công khi thiếu hạ tầng.

```text
Prompt đã chốt / mẫu / remix
  → Control Plane: quyền sở hữu, quota, idempotency, TTL
  → deployment QUEUED + outbox
  → scheduler chọn worker còn chỗ, có đúng image digest
  → GENERATING: OpenAI hoặc spec mẫu đã validate
  → BUILDING: chốt manifest toàn bộ AppSpec
  → DEPLOYING: container gVisor + database/role PostgreSQL riêng
  → probe runtime + gateway + HTTPS đúng app
  → RUNNING: link HTTPS riêng để chia sẻ
```

Các điểm vào là `/api/engine/generate`, `/api/engine/apps/from-template`, `/api/engine/apps/:id/remix`; API cũ cũng dùng adapter Control Plane. Luồng JSON tạo app trả 202, frontend theo dõi `/api/apps/:id/deployment` và chỉ mở host khi RUNNING. Worker không build code backend tùy ý; mọi app dùng image engine bất biến và manifest riêng.

Host quản lý nội dung qua dashboard với cookie riêng, Control Plane gọi runtime qua agent có xác thực. Participant truy cập trực tiếp `https://<id>.<APPS_DOMAIN>/rooms/<id>` hoặc `/`. Link `/rooms/:id` và `/a/:id` trên dashboard chuyển sang runtime khi deployment RUNNING, còn TTL và hostname khớp cấu hình. Không truyền token quản lý qua URL hoặc cookie dùng chung domain.

Khi remix hoàn tất, parent chỉ được đánh dấu `movedTo` sau khi child RUNNING. State công khai có `movedToUrl` để trình duyệt chuyển sang đúng domain của child, thay vì tìm child trong database của parent. Runtime suy ra domain từ `APP_ORIGIN` do worker cấp; không cần gọi Control Plane cho lần điều hướng này. Link host vẫn ở dashboard, nơi giữ quyền quản lý và chạy AI.

## Phạm vi và giới hạn

- Mỗi app có container, hostname, database và role riêng, nhưng chia sẻ máy chủ/cluster PostgreSQL. Đây không phải một VM riêng cho mỗi app.
- Compose, quiz, wheel, custom dùng engine đầy đủ. Ảnh trong runtime được lưu trong snapshot của database app khi không dùng Supabase Storage; vẫn chịu giới hạn ảnh/snapshot hiện có.
- Custom HTML/JS vẫn bị sandbox và CSP chặn mạng. Tạo độc lập không cấp quyền chạy backend hoặc gọi API tùy ý.
- Live block chạy được với dữ liệu mẫu có nhãn; dữ liệu thời tiết/tỷ giá thật còn cần egress proxy. Không nới firewall để gọi mạng tùy ý.
- VietQR không xác minh giao dịch ngân hàng; tài khoản/quản lý/remix vẫn thuộc Control Plane.
- App cũ chạy memory/Supabase ở chế độ standalone không tự được di chuyển vào deployment. Flow này áp dụng cho app tạo qua Control Plane.

## Kiểm tra

`tests/unit/independent-app-flow.test.ts` đưa toàn bộ mẫu Việt/Anh qua builder, manifest và snapshot, kiểm tra không mất field hoặc payload; kiểm tra URL qua domain khi remix, trạng thái triển khai trước redirect và runtime không cần truy vấn Control Plane. Test này không chứng minh Docker, DNS, OpenAI hoặc PostgreSQL production đã chạy.

Chạy `npm run env:check`, `npm run check`, `npm run build:worker`, `npm run test:e2e`. Kiểm thử cách ly database thật và worker nằm trong `npm run test:platform`; kiểm thử gVisor thực tế dùng `npm run smoke:runtime` theo [kiến trúc runtime](architecture-runtime.md).
