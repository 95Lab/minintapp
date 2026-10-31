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

Ứng dụng web hiện có trang chờ và `GET /api/health`. Các module dùng chung trong `src/lib/` đã có schema/type, request validation, lỗi Việt/Anh, token hashing, contract repository và adapter OpenAI. Xem [shared-foundation.md](shared-foundation.md) để biết phạm vi contract.

Chỉ dùng OpenAI cho AI. Thêm `OPENAI_API_KEY` vào `.env.local`, chọn `OPENAI_MODEL` (mặc định `gpt-5-mini`) và chạy `npm run env:check`. Nếu model không hỗ trợ reasoning, đặt `OPENAI_REASONING_EFFORT=`. Thiếu key thì gọi generation sẽ báo `ai_not_configured`; không tự chuyển sang mock. Các biến Gemini/Groq/LM Studio không còn trong mẫu và không được dùng. `.env.local` cũ vẫn được giữ nguyên; có thể tự bỏ các dòng provider cũ. Nếu có `LLM_PROVIDER`, chỉ chấp nhận giá trị rỗng hoặc `openai`.

`generateAppSpec({ prompt, lifetime })` là hàm server dùng Responses API + Structured Outputs, xác minh lại nghiệp vụ bằng Zod, không lưu dữ liệu và không mở endpoint HTTP mới. Không có route `/api/generate`, repository memory, Supabase adapter hay migration ở bước này. Health chỉ phản ánh tiến trình web. Build và kiểm thử không cần API key.
Thư viện UI: mở `/preview`; xem [kiến trúc component](components.md) để nối callback và phân biệt tính năng hiện có với các điểm mở rộng.

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

Khung được viết mới trong repo này; không nhập lịch sử Git, secrets hay dữ liệu từ dự án khác.

Giữ Next.js/React/TypeScript, Vitest, Playwright và quy ước tên biến môi trường. Phiên bản được xác minh qua npm; Vitest 5 yêu cầu Node từ 22.12; Node 20 không được hỗ trợ. Node 22 là môi trường chuẩn cho nhóm và CI. Không tạo commit hoặc push trong tác vụ thiết lập này.
