# Phát triển và kiểm tra

## Cài đặt

Dùng Node 22 (`nvm install && nvm use`) và npm. `package-lock.json` là lockfile duy nhất.

```sh
npm ci
npm run env:local
npm run env:check
npm run dev
```

Mở http://localhost:3000. `env:local` tạo `.env.local` từ mẫu và không ghi đè file đã tồn tại. File thật được Git bỏ qua. Không đưa khóa service-role vào biến `NEXT_PUBLIC_*`.

Trang chủ đã tạo được mẫu bình chọn, quiz và wheel, mở trang host `/a/[id]/host` và chia sẻ trang participant `/a/[id]`. `APP_STORAGE=memory` mặc định lưu app và vote trong một tiến trình Node; dữ liệu mất khi restart, client polling mỗi 1,5 giây. `APP_STORAGE=supabase` lưu bền và đồng bộ bằng Realtime. Host có thể đóng, mở lại hoặc kết thúc và xóa câu trả lời; quiz có open/reveal, wheel có spin/reset.

Luồng tạo từ mẫu không cần API key, Supabase hoặc Docker. Có mẫu `poll-drinks`, `quiz-general`, `wheel-participants`, `wheel-options`. Trang chủ cũng đã nối `POST /api/generate` để tạo app bằng OpenAI; luồng AI cần cấu hình `OPENAI_API_KEY` trong `.env.local`, chọn `OPENAI_MODEL`, chạy `npm run env:check` rồi khởi động lại server. Xem [generation](generation.md). Đã có Supabase adapter, migration và Realtime; xem [setup Supabase](supabase.md) để bật lưu bền.

Thử trên điện thoại: chạy `npm run dev`, mở trang chủ bằng địa chỉ IP LAN của máy chạy server, ví dụ `http://192.168.1.10:3000`, rồi tạo app và chia sẻ QR. Các thiết bị cần cùng mạng và truy cập được cổng 3000. Link localhost chỉ dùng trên máy đang chạy server. Quyền host gắn với cookie của trình duyệt đã tạo app; link host không tự cấp quyền.

Xem [API contract](api-contract.md), [file dùng chung](shared-foundation.md) và [component](components.md). Trang `/preview` tiếp tục là thư viện UI, riêng dữ liệu preview không được lưu lên server.
## Kiểm tra trước khi review

```sh
npm run env:check
npm run check
npx playwright install chromium
npm run test:e2e
```

`check` chạy TypeScript, unit test và production build theo thứ tự. E2E chạy production server riêng trên cổng 3100; cần build thành công trước và cổng còn trống. Chromium chỉ cần cài lần đầu hoặc sau khi nâng Playwright. Cấu hình E2E bỏ qua HTTP proxy cho localhost và giữ các mục NO_PROXY hiện có.

Smoke với server đang chạy:

```sh
npm run smoke
# Server khác:
SMOKE_BASE_URL=http://127.0.0.1:3100 npm run smoke
```

CI chạy trên Node 22, cài sạch bằng `npm ci`, kiểm tra môi trường mẫu, typecheck, unit test, build và E2E Chromium. Không dùng secret hay gọi AI thật. Generation được kiểm tra bằng provider/HTTP/API giả lập, gồm cả SDK parser thực; không coi các test đó là bằng chứng model/quota thật. E2E kiểm tra bình chọn thật qua API với các browser context độc lập, đổi vote, giữ lựa chọn sau reload, host đóng/mở/kết thúc và chặn quyền participant. Khi bổ sung nghiệp vụ, thêm unit test vào `tests/unit`, E2E vào `tests/e2e`. Supabase được kiểm thử bằng PostgreSQL nhúng và WebSocket giả lập; kiểm tra project thật riêng bằng `npm run supabase:check`. AI eval và load chưa có; không xem smoke bootstrap là bằng chứng tương đương chức năng.

## Nguồn tham chiếu và phạm vi

Khung được viết mới trong repo này; không nhập lịch sử Git, secrets hay dữ liệu từ dự án khác.

Giữ Next.js/React/TypeScript, Vitest, Playwright và quy ước tên biến môi trường. Phiên bản được xác minh qua npm; Vitest 5 yêu cầu Node từ 22.12; Node 20 không được hỗ trợ. Node 22 là môi trường chuẩn cho nhóm và CI. Không tạo commit hoặc push trong tác vụ thiết lập này.

## Deploy tự động

Cấu hình Docker standalone, Caddy và GitHub Actions đã có trong repo. Xem [hướng dẫn VPS](deployment.md) để bootstrap, cấu hình secrets và kích hoạt deploy. Khi chưa có VPS/secrets hoặc chưa push workflow, deployment chưa hoạt động.
