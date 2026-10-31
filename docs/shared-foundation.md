# File dùng chung và OpenAI

Đối chiếu cấu trúc và trường contract ở repo `hoangthuc701/MinintApp`, commit `9dc84f7998c0778c18f0445c7fe4a077bdf13221`. Implementation viết mới trong repo này, không nhập lịch sử hoặc secret. Không tạo commit hay push.

## Điểm nhập cho nhóm

| File/thư mục | Vai trò |
|---|---|
| `src/lib/app-spec/app-spec-schema.ts` | AppSpec v1 và type Locale/ThemeName |
| `src/lib/app-spec/app-spec-examples.ts` | Factory fixture quiz và poll compose hợp lệ |
| `src/lib/app-spec/strip-private-fields.ts` | Tạo bản public độc lập, ẩn đáp án quiz chưa reveal |
| `src/lib/blocks/` | Primitive, schema compose/quiz/wheel, payload, runtime |
| `src/lib/api/api-contract-types.ts` | Request/response chung, lifetime và generation event dự kiến |
| `src/lib/api/request-schemas.ts` | Validation request ở trust boundary |
| `src/lib/api/route-helpers.ts` | Chuyển lỗi sang HTTP mà không trả lỗi thô của provider |
| `src/lib/config/` | Một schema môi trường cho CLI và server; guard `server-only` |
| `src/lib/db/apps-repository-types.ts` | Interface lưu app/response tối thiểu, chưa có adapter |
| `src/lib/security/token-hashing.ts` | Token ngẫu nhiên, hash, so sánh và hash participant theo app |
| `src/lib/i18n/api-strings-vi-en.ts` | Thông báo lỗi Việt/Anh |
| `src/lib/generation/` | Hàm generate spec, system prompt và client OpenAI duy nhất |

Request types được suy ra từ schema Zod. Không khai báo lại type ở frontend. Không import runtime config, token helpers hoặc SDK OpenAI vào client component; Next.js chặn qua `server-only`.

## Phạm vi hiện tại so với bản tham chiếu

Giữ tên trường AppSpec: `specVersion`, `locale`, `title`, `description`, `theme`, `requireName`, `layout`, `blocks`. Các id phải duy nhất trong collection. Quiz và wheel giữ trường lõi của bản tham chiếu; wheel participant bắt buộc `requireName=true`.

Compose hiện hỗ trợ input `text/number/choice/rating/slot/date/datetime`, view `bars/stat/table/leaderboard/cloud`, `entries=one`, `flow=open`. Trường `note` và các trường nullable được giữ. Kiểm tra option, range, nguồn view, loại dữ liệu và điều kiện `showIf` cơ bản. Payload chỉ có `kind` và `values`.

Đây là contract ban đầu, chưa tương đương toàn bộ repo gốc. Chưa có preset expansion, query/expression, entries nhiều dòng, steps, roster, ảnh, map, settle, chat, live/custom block; các cấu hình này bị từ chối thay vì bị bỏ qua. Chưa có tính kết quả hoặc kiểm tra response theo app/quiz state ở server. `AppRuntime`, repository và lifecycle contract mới có phần tối thiểu; chưa có account, payee, redirect hoặc upload contract. Khi bổ sung một nhóm chức năng phải cập nhật schema, type và test cùng lúc.

`GenerateEvent` giữ hướng thiết kế NDJSON với `done` trả id/hostToken cho route lưu trữ trong tương lai. Không dùng kết quả của hàm sinh spec thay cho event `done`: hàm chưa lưu app và chưa cấp token.

## OpenAI

```ts
// Chỉ gọi từ server, sau khi route đã xác thực và giới hạn tần suất/ngân sách.
import { generateAppSpec } from "@/lib/generation/generate-app-spec";
const { spec, generation } = await generateAppSpec({
  prompt: "Bình chọn đồ uống cho buổi workshop",
  lifetime: "1h",
});
```

SDK chính thức dùng `responses.parse()` với `zodTextFormat`, `store: false`, giới hạn output, không retry tự động và deadline mặc định 18 giây. OpenAI xác minh cấu trúc; schema local kiểm tra lại các ràng buộc liên trường. Output thiếu, incomplete, refusal và lỗi provider được phân biệt bằng mã lỗi. Client khởi tạo khi gọi, nên build không cần secret.

Tham khảo [Structured Outputs — OpenAI Docs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).

Các bài kiểm tra dùng provider mock, có chạy chuyển Zod sang JSON Schema thực của SDK; chưa gọi OpenAI thật hoặc xác nhận quota/model trên tài khoản. System prompt có hướng dẫn an toàn nhưng chưa thay thế moderation hay kiểm tra phishing. Trước khi mở route công khai cần bổ sung quyền, rate limit, ngân sách và lớp kiểm tra nội dung phù hợp.
