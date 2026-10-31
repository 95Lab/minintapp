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

Khung hiện tại chỉ có trang chờ và `GET /api/health`. Không cần Supabase, Docker hoặc API key. Các tên biến Supabase/LLM trong `.env.example` dành cho các adapter sẽ triển khai sau; điền biến chưa kích hoạt tích hợp. Health chỉ phản ánh tiến trình web, không xác minh database/AI. Không có repository memory, generator hay migration trong giai đoạn này.

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

CI chạy trên Node 22, cài sạch bằng `npm ci`, kiểm tra môi trường mẫu, typecheck, unit test, build và E2E Chromium. Không dùng secret hay gọi AI thật. Khi bổ sung nghiệp vụ, thêm unit test vào `tests/unit`, E2E vào `tests/e2e`. Kiểm thử Supabase, AI eval và load sẽ được thêm khi có implementation và contract; không xem smoke bootstrap là bằng chứng tương đương chức năng.

## Nguồn tham chiếu và phạm vi

Đã đọc `package.json`, `AGENTS.md`, `.env.example` và runtime config của [repo tham chiếu](https://github.com/hoangthuc701/MinintApp/tree/9dc84f7998c0778c18f0445c7fe4a077bdf13221) tại commit `9dc84f7998c0778c18f0445c7fe4a077bdf13221` qua GitHub API chỉ đọc. Khung được viết mới trong repo này; không nhập lịch sử Git, implementation, secrets hay dữ liệu bản gốc.

Giữ Next.js/React/TypeScript, Vitest, Playwright và quy ước tên biến môi trường. Phiên bản được xác minh qua npm; Vitest 5 yêu cầu Node từ 22.12; Node 20 không được hỗ trợ. Node 22 là môi trường chuẩn cho nhóm và CI. Không tạo commit hoặc push trong tác vụ thiết lập này.
