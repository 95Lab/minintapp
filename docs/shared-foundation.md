# File dùng chung và OpenAI

Implementation trong repo này, không nhập lịch sử hoặc secret từ dự án khác. Không tạo commit hay push.

## Điểm nhập cho nhóm

| File/thư mục | Vai trò |
|---|---|
| `src/lib/app-spec/app-spec-schema.ts` | AppSpec v1 và type Locale/ThemeName |
| `src/lib/app-spec/app-spec-examples.ts` | Factory fixture quiz và poll compose hợp lệ |
| `src/lib/app-spec/strip-private-fields.ts` | Tạo bản public độc lập, ẩn đáp án quiz chưa reveal |
| `src/lib/blocks/` | Primitive, schema compose/quiz/wheel, payload, runtime |
| `src/lib/api/api-contract-types.ts` | Request/response chung, lifetime và trạng thái generation UI |
| `src/lib/api/request-schemas.ts` | Validation request ở trust boundary |
| `src/lib/api/route-helpers.ts` | Chuyển lỗi sang HTTP mà không trả lỗi thô của provider |
| `src/lib/config/` | Một schema môi trường cho CLI và server; guard `server-only` |
| `src/lib/db/apps-repository-types.ts` | Contract lưu app/response; memory và Supabase adapter dùng chung domain mutations |
| `src/lib/security/token-hashing.ts` | Token ngẫu nhiên, hash, so sánh và hash participant theo app |
| `src/lib/i18n/api-strings-vi-en.ts` | Thông báo lỗi Việt/Anh |
| `src/lib/generation/` | Hàm generate spec, system prompt và client OpenAI duy nhất |

Request types được suy ra từ schema Zod. Không khai báo lại type ở frontend. Không import runtime config, token helpers hoặc SDK OpenAI vào client component; Next.js chặn qua `server-only`.

## Runtime đầy đủ

Contract mở rộng ở `src/engine/app-spec/`, `src/engine/blocks/` và `src/engine/api/`; renderer ở `src/engine-ui/`. Luồng mới dùng `/api/engine/` và `/rooms/`; các contract `src/lib` giữ tương thích cho API cũ và sở hữu adapter snapshot dùng chung. Xem `full-runtime.md` và `parity-checklist.md` để biết các input, view, account, ảnh, live/custom và remix đã hỗ trợ.

## OpenAI

```ts
// Chỉ gọi từ server, sau khi route đã xác thực và giới hạn tần suất/ngân sách.
import { generateAppSpec } from "@/lib/generation/generate-app-spec";
const { spec, generation } = await generateAppSpec({
  prompt: "Bình chọn đồ uống cho buổi workshop",
  lifetime: "1h",
});
```

SDK chính thức dùng `responses.parse()` với `zodTextFormat`, `store: false`, giới hạn output và không retry transport tự động. Tối đa một lượt repair cho output/schema sai, dùng chung deadline mặc định 18 giây với lượt đầu. OpenAI xác minh cấu trúc; schema local kiểm tra lại các ràng buộc liên trường. Output thiếu, incomplete, refusal và lỗi provider được phân biệt bằng mã lỗi. Client khởi tạo khi gọi, nên build không cần secret.

Tham khảo [Structured Outputs — OpenAI Docs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).

Các bài kiểm tra dùng provider mock, có chạy SDK parser thật với HTTP response giả lập và route tạo app; chưa gọi OpenAI thật hoặc xác nhận quota/model trên tài khoản. System prompt có hướng dẫn an toàn nhưng chưa thay thế moderation hay kiểm tra phishing. Đã có giới hạn generation theo giờ/concurrency của một process và kiểm tra plain text/URL/HTML, nhưng chưa có moderation, đánh giá đúng ý định hoặc rate limit theo IP/tài khoản. Xem `generation.md` để cấu hình và biết giới hạn.

Supabase lưu snapshot bằng RPC compare-and-swap, chỉ service role đọc/ghi bảng; Realtime chỉ broadcast version rồi client tải state theo quyền. Xem [Supabase](supabase.md).

## Deployment metadata

Contract build/deploy độc lập với trạng thái nghiệp vụ của app ở `src/lib/deployments/`; repository ở `src/lib/db/deployments-repository-types.ts`, chọn memory/Supabase qua `deploymentsRepository()`. Type suy ra từ Zod, có version lock, idempotency và lịch sử lỗi. Migration `202610310003_deployments.sql` chỉ cấp service role. Đây mới là metadata; chưa provision sandbox/DNS hoặc tự nối vào generation. Xem [contract deployment và job](deployments.md).

## Template runtime bình chọn

`poll-v1` có contract projection tại `src/lib/blocks/poll-runtime-schema.ts`, request/response tại `src/lib/api/poll-runtime-contract.ts`, converter từ AppSpec chuẩn hóa + deployment tại `src/lib/deployments/poll-runtime-manifest.ts`. Không dùng AppRecord làm cấu hình public. Runtime và SQLite repository độc lập ở `runtime/poll/`; không gọi database của dashboard. Converter từ chối capability chưa hỗ trợ thay vì bỏ qua. Xem [poll runtime](poll-runtime.md) để build, chạy, giới hạn và kế hoạch nối Cloudflare.
