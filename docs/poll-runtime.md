# Template bình chọn độc lập: poll-v1

Một Node process và một SQLite volume riêng cho một deployment. Runtime không gọi API dashboard, OpenAI, Supabase hoặc Cloudflare. Đây là template cố định; chưa chạy code tùy ý do AI sinh.

## Đã có

- Server Node 22 (`node:sqlite`), frontend độc lập, `/health` và API bình chọn/host.
- Hai đến mười lựa chọn, mỗi trình duyệt một phiếu có thể sửa; tên bắt buộc khi spec yêu cầu.
- Host đóng/mở/kết thúc; kết thúc xóa toàn bộ phiếu trong transaction. Trạng thái và phiếu giữ qua restart.
- Visibility `everyone`, `after_submit`, `after_close`, `host` được kiểm tra phía server. State chỉ trả lựa chọn/tên của chính participant và tổng hợp được phép thấy, không trả danh sách người dùng.
- TTL kiểm tra cả đọc lẫn ghi. `/health` vẫn 200 cho liveness và trả `expired`/`ended`; hết hạn không có nghĩa workload đã được worker thu hồi.
- SQLite WAL + synchronous FULL, giới hạn 1.000 participant, upsert và host action dùng transaction. Một replica mỗi app; chưa hỗ trợ shared/multi-replica SQLite hoặc migration giữa VM.
- Manifest khóa với volume. Thay spec/deployment/thời hạn trong manifest rồi tái dùng volume cũ sẽ từ chối khởi động; không âm thầm gán dữ liệu cho app khác.

## Chuyển từ AppSpec

`src/lib/deployments/poll-runtime-manifest.ts` nhận AppSpec và DeploymentRecord. `runtimeSpecHash()` hash canonical của spec chuẩn hóa/expand preset; dùng cùng helper khi tạo deployment. Builder phải lưu snapshot spec đã chốt, không lấy spec mới nhất thay thế.

`createPollRuntimeManifest()` chỉ nhận đúng `templateVersion=poll-v1`, specHash khớp, một compose block, một required choice input, `multi=false`, `entries=one`, `flow=open` và một bars view nối tới input đó. Choice preset được expand trước khi xét capability. Giá, capacity, query, điều kiện, timer, nhiều block/trường, quiz/wheel và các view khác bị từ chối bằng `unsupported_poll_spec`. Không bỏ qua cấu hình chưa hỗ trợ.

Contract manifest ở `src/lib/blocks/poll-runtime-schema.ts`; request/response Zod ở `src/lib/api/poll-runtime-contract.ts`. Manifest chỉ chứa projection cần cho poll, không chứa hostTokenHash, đáp án quiz, prompt hoặc config chứa secret. Runtime kiểm tra schema; manifest là cấu hình tin cậy do builder cấp, không phải input public có chữ ký. SpecHash là liên kết snapshot ở Control Plane; runtime không có toàn bộ spec để tự tính lại hash nguồn.

## Chạy local

```sh
nvm use
npm run runtime:poll:demo
```

Mở http://127.0.0.1:3210/ và http://127.0.0.1:3210/host. Khóa quản lý nằm trong `.runtime-local/host-token` mode 600; script không in khóa. Không đưa file này vào Git hoặc gửi lên chat. Truy cập file tại máy để nhập khóa vào form host. Trình duyệt chỉ giữ khóa trong memory của trang, không localStorage/cookie/URL.

Script tạo dữ liệu demo mới khi file chưa tồn tại, không ghi đè manifest/key/SQLite hiện có. Demo sống 24 giờ; muốn tạo phiên mới, chuyển thư mục `.runtime-local` sang vị trí khác rồi chạy lại. Hash toàn số 0 chỉ dùng cho manifest demo độc lập, không dùng làm snapshot deployment thật.

```sh
npm run runtime:poll:build
# Đặt POLL_MANIFEST_FILE, POLL_HOST_TOKEN_FILE, POLL_DB_FILE nếu dùng vị trí riêng.
npm run runtime:poll:start
```

Build output trong `.runtime-build`, không có Next.js hoặc dashboard bundle. Chỉ cần built-in Node, `zod`, `server-only`; `--conditions=react-server` chọn marker server-only phù hợp cho standalone process. Node 22 hiện đánh dấu `node:sqlite` là experimental; đã kiểm thử trên Node 22.23.4. Template Docker khóa cùng phiên bản Node, chưa pin base-image digest; build worker phải pin base digest và output image digest khi triển khai production.

## Cấu hình runtime

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `POLL_MANIFEST_FILE` | `/config/manifest.json` | Manifest read-only theo schema |
| `POLL_HOST_TOKEN_FILE` | `/run/secrets/poll-host-token` | Khóa riêng của mini-app: 32 byte random, biểu diễn 64 hex; worker cung cấp file secret, không dùng key dashboard |
| `POLL_DB_FILE` | `/data/poll.sqlite` | SQLite trên dedicated writable volume |
| `PORT` | `3000` | Cổng nội bộ sandbox |
| `POLL_LOCAL_ORIGIN` | không đặt | Chỉ cho demo HTTP loopback `127.0.0.1`/`localhost`; khi bật server chỉ bind 127.0.0.1 |

Production bắt buộc origin `https://<manifest.hostname>`. Header Host phải khớp; không tin `X-Forwarded-Host/Proto`. Gateway phải preserve hostname gốc. Chỉ `/health` cho phép thêm localhost để container healthcheck hoạt động. Runtime tự bind HTTP nội bộ; TLS kết thúc ở gateway, không bật local override cho production.

Participant cookie là host-only `__Host-minint_poll`, HttpOnly, Secure, SameSite Strict; không đặt Domain. Local demo dùng cookie khác không Secure. Mọi POST cần Origin chính xác và JSON, body tối đa 4 KiB. Host dùng `Authorization: Bearer <runtime-key>`; không chia sẻ cookie dashboard. Token được hash khi lưu SQLite, phản hồi không trả token/hash. Cookie chỉ là định danh theo trình duyệt; xóa cookie/đổi trình duyệt có thể có phiếu mới, chưa xác minh danh tính người thật. Chưa có rate limit/WAF theo IP: gateway cần áp dụng trước khi public.

## Docker và cách ly

```sh
docker build -f runtime/poll/Dockerfile -t minint-poll-runtime:local .
```

Runner dùng UID/GID 1000, không có package/dashboard secret. Worker sau này phải:

- Cấp một named volume `/data` riêng, ghi được bởi UID 1000; mount manifest và secret riêng read-only, file secret đọc được bởi UID 1000, không mount thư mục host tùy ý.
- Chạy `--read-only --cap-drop=ALL --security-opt=no-new-privileges`, giới hạn CPU/RAM/PIDs và runtime `runsc`; không mount Docker socket hoặc gửi platform credentials vào app.
- Chặn egress tới control plane, metadata và sandbox khác; chỉ gateway được vào cổng 3000. Không publish cổng ra Internet trực tiếp.
- Gửi SIGTERM để shutdown, snapshot volume nhất quán khi di chuyển, tự stop/reclaim khi TTL đến.

Dockerfile chưa tự cấu hình gVisor/network/quota: đó là trách nhiệm Worker Agent. Chưa build/run Docker hoặc gVisor thật trong môi trường phát triển hiện tại vì chưa có Docker CLI.

## Cloudflare

Ghi nhận domain được quản lý bằng Cloudflare. Không cần Cloudflare token cho bước template này. Khi nối provisioning:

1. Control Plane tạo CNAME subdomain app trỏ shared ingress, lưu `dnsRecordId` trong DeploymentRecord. Token DNS chỉ ở Control Plane.
2. Gateway route hostname tới sandbox, không route hostname lạ vào app mặc định. Domain runtime phải tách khỏi domain dashboard theo tài liệu kiến trúc.
3. Cloudflare dùng Full (strict); gateway có chứng chỉ origin hợp lệ cho hostname app. Tham khảo https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/ .
4. Probe HTTPS `/health` qua hostname public và đối chiếu `deploymentId`, `specHash`, `templateVersion`, `expired=false`, `ended=false` rồi mới gửi lệnh metadata `ready`. Docker liveness 200 một mình không đủ để đánh dấu RUNNING.
5. Cache bypass cho toàn bộ runtime/API; origin trả `Cache-Control: no-store`. Không cấu hình Cache Everything làm lộ state theo participant.

Chưa tạo DNS, gateway, queue/build worker hoặc nối luồng generate vào deployment. Khóa/hostname thật sẽ được cấu hình ở hạng mục provisioning.

## Kiểm thử

```sh
npx vitest run tests/unit/poll-runtime.test.ts tests/unit/poll-runtime-manifest.test.ts
npm run env:check
npm run check
npm run test:e2e
```

Unit dùng SQLite thật, gồm persistence, kết thúc/xóa phiếu, visibility, TTL, bảo vệ host/origin, sai hostname, payload limit, snapshot và capability. E2E khởi chạy artifact đã compile bằng process Node riêng, dùng hai browser context, restart process và kiểm tra phiếu còn nguyên, host control, mobile và HTTP expiry. E2E không chứng minh Docker/gVisor, DNS/TLS hoặc Cloudflare production đã chạy.
