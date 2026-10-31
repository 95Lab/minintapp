# Đối chiếu phần port — 2026-10-31

Đối chiếu bản tham chiếu đã lưu tại commit `9dc84f7998c0778c18f0445c7fe4a077bdf13221`. Cả 363 file đã tải khớp Git blob hash trong cây tham chiếu. Lần kiểm tra này GitHub trả 404, nên chưa xác nhận được các thay đổi mới hơn commit đó. Không thay đổi source trong đợt audit này.

## Kết luận

Chưa phải bản sao đầy đủ 1:1. Có đủ file tương ứng cho 46 component tham chiếu trong `src/engine-ui`; phần nghiệp vụ chính đã chuyển vào `src/engine`. Nhưng công cụ vận hành/đánh giá, một số cấu hình bảo vệ và tối ưu tải chưa chuyển đầy đủ. File tồn tại không chứng minh mọi hành vi tương đương.

## Các khoảng trống đã xác nhận

| Mức ưu tiên | Phần còn thiếu hoặc khác | Bằng chứng trong dự án hiện tại |
|---|---|---|
| Cao | Proxy deploy đang giới hạn body 16KB, không phù hợp ảnh upload đến 600KB | `deploy/Caddyfile` có `max_size 16KB`; `src/engine/db/apps-repository.ts` cho phép bucket file 600000 bytes. Ảnh hợp lệ lớn hơn 16KB sẽ bị proxy từ chối trước khi tới route; E2E đang gọi Node trực tiếp nên không phát hiện đường đi này. |
| Cao khi tải lớn | Chưa có cơ chế fanout theo nhóm host/participant và gộp broadcast như tham chiếu | `src/engine/realtime/broadcast-app-changed.ts` là no-op; snapshot commit phát invalidation tới toàn room. Source tham chiếu tách control/results, giới hạn results 1 lần/giây. Cách hiện tại hoạt động chức năng nhưng có nguy cơ nhiều message/read khi đông participant. |
| Trung bình | Cache đọc state theo phiên bản chưa được nối vào hot path | `src/engine/responses/responses-cache.ts` và `src/engine/db/app-record-cache.ts` tồn tại, nhưng GET `/api/engine/apps/:id/state` đọc toàn snapshot trước khi kiểm ETag. HTTP 304 chưa tránh được đọc answers từ DB như tham chiếu. Cần thiết kế cache theo snapshot/CAS, không sao chép máy móc gây stale state. |
| Trung bình | HTTP security headers chưa chuyển đầy đủ vào Next | `next.config.ts` chưa có rules headers của tham chiếu: Referrer-Policy, X-Frame-Options, Permissions-Policy, HSTS production và ngoại lệ sandbox. Caddy mới bổ sung một phần; CSP đã có trong `src/proxy.ts`. |
| Trung bình | Bộ đánh giá AI chưa port | Thiếu toàn bộ `eval/` gồm generation prompts, remix prompts, phishing corpus và intent rubric; thiếu `scripts/eval-generation.mjs`, `eval-generation-structure-checks.mjs`. Unit/mock không thay cho đánh giá chất lượng AI thật. |
| Trung bình | Công cụ đo tải và chạy demo chưa port | Thiếu `load-test-participants.mjs`, `load-test-realtime-fanout.mjs`, `seed-demo-apps.mjs`, `warmup-before-demo.mjs`, `smoke-host-accounts.mjs`. `scripts/smoke.mjs` và kiểm thử tích hợp hiện có không thay thế đầy đủ các công cụ này. |
| Trung bình | Bộ kiểm thử chưa tương đương toàn bộ tham chiếu | Chưa port nguyên bộ golden snapshot, fanout/cache/coalescing, import-cycle, account offline E2E và các test chuyên biệt host/rate limit/IP/presenter. Một phần đã có coverage thay thế trong `tests/unit/full-runtime-routes.test.ts` và `tests/integration`, nhưng chưa lập đối chiếu từng assertion. |
| Thấp | Health của engine chưa kiểm tra storage thật | `src/app/api/engine/health/route.ts` trả `storageOk:true` cố định. Không nên coi đây là readiness DB; dùng kiểm tra Supabase riêng hiện có. |

## Khác biệt chủ động, không phải thiếu port

- Chỉ OpenAI: không port Gemini, OpenAI-compatible/local provider, registry chọn provider và production mock generation.
- Giữ trang chủ/giao diện hiện tại; component đầy đủ nằm ở `src/engine-ui` thay vì ghi đè toàn bộ `src/components`.
- Route đầy đủ dùng `/api/engine/` và `/rooms/`; API/link ban đầu giữ tương thích. Không kết luận thiếu route chỉ vì khác đường dẫn.
- Repository snapshot JSONB/CAS và Supabase Storage thay schema nhiều bảng/ảnh bytea của tham chiếu. Các SQL migration cũ không cần copy nguyên để tránh hai mô hình lưu trữ xung đột.
- Host token dùng cookie HttpOnly thay localStorage; Realtime invalidation phát từ giao dịch database.
- Script sửa env và cấu hình Supabase local không được copy nguyên; dự án có setup/check riêng và đang dùng project remote.

## Phần đã có nhưng chưa xác minh dịch vụ thật

Generate/remix OpenAI, gửi email magic link và callback trên domain deploy, weather/fx thật, deploy/rollback thực tế và lịch cleanup định kỳ. Đây là phần xác minh vận hành, không phải file nghiệp vụ chưa copy.

Bằng chứng kiểm tra trước audit: 481 unit tests, 33 Playwright E2E, 3 Supabase integration tests và production build đã qua. Không chạy lại trong đợt audit chỉ đọc này; những con số đó không chứng nhận tải lớn hoặc tương đương mọi hành vi tham chiếu.
