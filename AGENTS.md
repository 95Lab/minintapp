# MinintApp

Repo này triển khai MinintApp. Không tự tạo commit/push nếu người dùng chưa yêu cầu.

## Công nghệ và kiểm tra

- Node 22 theo `.nvmrc`, npm theo `package-lock.json`; không tạo thêm lockfile khác.
- Next.js App Router, React, TypeScript strict, Zod, Vitest và Playwright.
- Trước khi sửa Next.js, đọc hướng dẫn phù hợp trong `node_modules/next/dist/docs/`; phiên bản này có thể khác kiến thức cũ.
- `npm run env:local` không ghi đè `.env.local`. Không ghi secret vào code, log, test fixture hoặc biến `NEXT_PUBLIC_*`.
- Chạy `npm run env:check` và `npm run check`; chạy `npm run test:e2e` sau build khi thay đổi route/UI hoặc cấu hình chạy app.

## File dùng chung

- `src/lib/app-spec/`, `src/lib/blocks/` sở hữu contract spec/payload.
- `src/lib/api/` sở hữu request schema và contract API. Suy ra type từ Zod, không khai báo type trùng ở component.
- `src/lib/db/` sở hữu contract repository. Route nghiệp vụ không truy cập database trực tiếp khi đã có repository.
- Chỉ dùng OpenAI cho AI. Không thêm provider registry hoặc fallback âm thầm sang mock/provider khác.
- Giữ SDK OpenAI, config chứa secret và token hashing phía server với `server-only`.
- Đối chiếu `docs/shared-foundation.md` trước khi mở rộng contract; không coi schema ban đầu là tương đương toàn bộ bản gốc.
- Cập nhật schema, type, fixtures và test cùng lúc khi đổi contract; ghi rõ chênh lệch hành vi còn lại.
- Không trả đáp án quiz chưa reveal hoặc hostTokenHash cho participant. Không dùng AppRecord làm response public trực tiếp.

Hướng dẫn setup: `docs/development.md`. Không đánh dấu AI/Supabase thật đã kiểm thử nếu chỉ chạy mock.
