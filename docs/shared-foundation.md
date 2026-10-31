# File dùng chung và OpenAI

Implementation viết mới trong repo này, không nhập lịch sử hoặc secret từ dự án khác. Không tạo commit hay push.

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
| `src/lib/db/apps-repository-types.ts` | Contract lưu app/response; memory adapter đã triển khai |
| `src/lib/security/token-hashing.ts` | Token ngẫu nhiên, hash, so sánh và hash participant theo app |
| `src/lib/i18n/api-strings-vi-en.ts` | Thông báo lỗi Việt/Anh |
| `src/lib/generation/` | Hàm generate spec, system prompt và client OpenAI duy nhất |

Request types được suy ra từ schema Zod. Không khai báo lại type ở frontend. Không import runtime config, token helpers hoặc SDK OpenAI vào client component; Next.js chặn qua `server-only`.

## Phạm vi hiện tại so với bản tham chiếu

Giữ tên trường AppSpec: `specVersion`, `locale`, `title`, `description`, `theme`, `requireName`, `layout`, `blocks`. Các id phải duy nhất trong collection. Quiz và wheel giữ trường lõi của bản tham chiếu; wheel participant bắt buộc `requireName=true`.

Compose hiện hỗ trợ input `text/number/choice/rating/slot/date/datetime`, view `bars/stat/table/leaderboard/cloud/summary`, `entries=one|many`, `flow=open|steps`. Trường `note` và các trường nullable được giữ. Kiểm tra option, range, nguồn view, loại dữ liệu và điều kiện `showIf` cơ bản. Payload có `kind`, `values` và `removed:true` khi xóa bản ghi nhiều dòng.

Đây là contract ban đầu, chưa tương đương toàn bộ repo gốc. Chưa có preset expansion, roster, ảnh, map, settle, chat, live/custom block; các cấu hình này bị từ chối thay vì bị bỏ qua. Đã có validation và tổng hợp cho poll một lựa chọn, tính điểm quiz sau reveal và wheel chọn ở server. Compose có validation server, thống kê, nhiều bản ghi, steps và query/expression; xem `compose-engine.md`. `AppRuntime`, repository và lifecycle contract mới có phần tối thiểu; chưa có account, payee, redirect hoặc upload contract. Khi bổ sung một nhóm chức năng phải cập nhật schema, type và test cùng lúc.

`GenerateEvent` dùng cho trạng thái UI. `/api/generate` hiện trả JSON `GenerateResponse` một lần sau khi sinh/validate và lưu thành công; không phải stream NDJSON. Cách này cho phép đặt cookie host HttpOnly khi id đã biết. Hàm `generateAppSpec()` chỉ sinh spec; route chịu trách nhiệm giới hạn yêu cầu, lưu và cấp quyền host.
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
