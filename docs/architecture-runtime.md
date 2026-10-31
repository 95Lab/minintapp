# MinintApp — Kiến trúc runtime đã triển khai

[Tiếng Việt](architecture-runtime.md) | [English](architecture-runtime.en.md)

## Ranh giới hệ thống

Thiết kế gốc nằm trong [architecture-design.md](../architecture-design.md). Bản này triển khai Control Plane và Runtime Plane cho demo một VM, có contract đặt app lên nhiều worker. Các route `/api/apps/*` và `/api/engine/*` dùng cùng repository; engine mở rộng, Supabase adapter và giao diện hiện có được giữ lại.

| Thành phần | Mã nguồn | Trách nhiệm |
|---|---|---|
| Control Plane | `src/lib/control-plane/` | Tenant, quota, tạo deployment, API điều khiển |
| Metadata | `platform/schema.sql`, `platform/store.ts` | PostgreSQL: deployment, worker, version, outbox, lịch sử trạng thái |
| Queue / Scheduler | `platform/scheduler.ts` | BullMQ, đặt chỗ bằng transaction, lọc heartbeat và image có sẵn |
| Builder | `platform/build-spec.ts` | OpenAI, moderation/validation, AppSpec và manifest phiên bản |
| Worker Agent | `platform/worker.ts` | Provision, health check, TTL, backup và private RPC |
| Sandbox | `platform/docker-runtime.ts` | gVisor, network/volume/cổng riêng, quota và firewall |
| Gateway | `platform/gateway*.ts` | Traefik file provider, route theo hostname, đồng bộ nhiều worker |
| DNS | `platform/cloudflare.ts` | Record riêng có nhãn sở hữu; mặc định không cho phép ghi |
| Dữ liệu app | `src/lib/runtime-plane/` | Database PostgreSQL và role riêng cho mỗi app |
| Artifact / backup | `platform/artifacts.ts`, `platform/backup.ts` | Manifest và snapshot JSONB nhất quán trên S3-compatible storage |

## Luồng tạo app

1. Browser có tenant capability trong cookie HttpOnly; HTTPS dùng prefix `__Host-`. Tài khoản Supabase đã xác thực có thể tiếp tục được nhận diện qua engine.
2. Control Plane ghi deployment vào PostgreSQL với host token hash, image digest, TTL và idempotency key. Trả `202`; frontend theo dõi trạng thái trước khi mở app. Luồng engine generation giữ NDJSON tiến độ.
3. Outbox được dispatcher đẩy vào BullMQ với job ID cố định. Crash sau khi enqueue không tạo job trùng.
4. Scheduler khóa transaction để đặt chỗ, chỉ chọn worker heartbeat còn mới, còn capacity và đã cache đúng image digest.
5. Builder sinh/validate AppSpec. Artifact là **image template bất biến + manifest AppSpec**, không chạy npm build cho code backend tùy ý do người dùng sinh. `BUILDING` là bước đóng gói manifest. Pipeline build code không đáng tin cậy trong sandbox tạm là phần mở rộng riêng, chưa được bật.
6. Agent tạo sandbox, cấp database/role PostgreSQL riêng, kiểm tra health, thêm route và DNS trong phạm vi đã phê duyệt. Chỉ chuyển `RUNNING` sau khi kiểm tra cả gateway nội bộ và HTTPS công khai đúng app ID.

## Cách ly và dữ liệu

- Runtime chỉ nhận seed và capability của chính app đó; không nhận API key OpenAI, Cloudflare, S3, database chung hoặc Docker socket.
- Container non-root, `runsc`, filesystem chỉ đọc, `/tmp` giới hạn, 0,5 CPU/512 MiB, giới hạn PID, log và snapshot 16 MiB. Một app chạy một replica.
- Mỗi app có bridge riêng, tắt IPv6 và DNS ra ngoài. Kiểm tra subnet với Docker và mọi route IPv4; chọn cổng loopback chưa được socket hoặc container nào đặt trước. Cổng được giữ cố định qua restart.
- Rule INPUT và DOCKER-USER chỉ khớp bridge của app, chỉ cho phép kết nối PostgreSQL đến IP/cổng private đã cấu hình, chặn các kết nối NEW khác; không đổi chính sách firewall của app cũ. Không có fallback sang runc nếu runsc không khả dụng.
- Trước cấp runtime mới, giữ ít nhất 1,5 GiB RAM khả dụng và 10 GiB đĩa trên host. Capacity mặc định 3 app/VM; quota global mặc định 3 và mỗi tenant 2 app. Các giới hạn cần đo lại theo tải thật.
- Mỗi app có database `app_<id>` và role cùng tên chỉ được CONNECT database đó, USAGE schema, SELECT/UPDATE snapshot của app. Admin sở hữu database/table; app không được DDL, đổi role, truy cập metadata hay database app khác. PostgreSQL row lock và transaction bảo vệ ghi đồng thời; CAS giữ `stateVersion` và bất biến app ID/host credential. Không fallback sang memory/SQLite khi DB lỗi.
- Backup snapshot JSONB nhất quán mỗi 5 phút vào bucket private. Hết hạn dừng runtime/xóa route và DNS, giữ database 24 giờ rồi xóa database, role và artifact. Volume SQLite cũ được giữ riêng sau migration để rollback có kiểm soát. Xóa chủ động bỏ thời gian lưu giữ. Rollback image không khôi phục dữ liệu đã xóa.

## Credential và DNS

systemd nạp `/root/.config/ai-secrets/api.env` bằng `EnvironmentFile`; Worker chỉ dùng `process.env`, không tự đọc file secrets. Docker Compose chỉ inject credential cần thiết cho từng service. Không tạo file bản sao API key. Control Plane chỉ nhận credential nội bộ cần thiết qua environment, sandbox không nhận các key nền tảng.

Các secret nội bộ `DATABASE_URL`, `REDIS_URL`, `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `WORKER_TOKEN`, `IP_HASH_SALT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` được lưu cùng file trung tâm; không đưa giá trị vào Git hoặc log. Nếu đổi worker token, phải rollout lại capability của runtime hiện có, không chỉ sửa file rồi restart agent.

`DNS_AUTOMATION_APPROVED` mặc định false. Phạm vi demo được chủ hệ thống phê duyệt: ingress A, CNAME app ID 24 hex dưới `minintapp.io.vn` và TXT ACME tạm để cấp/gia hạn wildcard TLS. Record khác không được sửa. `deploy/acme-cloudflare.py` chỉ đụng TXT có nội dung validation và nhãn sở hữu tương ứng.

## Deploy và nhiều VM

`deploy/platform.compose.yml` là overlay lên Compose web hiện có. PostgreSQL, Redis và MinIO dùng volume riêng. Redis/MinIO chỉ bind loopback; PostgreSQL thêm bind vào gateway bridge private cho sandbox, không bind IP public. Nginx hiện tại giữ 80/443, chuyển app hostname đến Traefik loopback 18081. Agent bind bridge/private IP 19090 và yêu cầu bearer token.

CI build và kiểm tra image trên GitHub. Image chứa bundle Worker và schema; gate chỉ nhận digest thuộc repo. Khi `.platform-enabled` tồn tại, deploy thay Worker bundle và web image, kiểm tra health rồi promote, hoặc thử rollback cả hai. Database/queue/objectstore và sandbox không bị force-recreate mỗi commit.

**Trust boundary:** main và publisher GHCR là code quản trị đáng tin cậy. Worker chạy đặc quyền để điều khiển Docker/firewall; cập nhật bundle Worker đồng nghĩa chạy code server đặc quyền. Giới hạn SSH command không biến code trên main thành code không đáng tin cậy có thể chạy an toàn. Bảo vệ quyền ghi main/package và deployment secrets.

Thêm VM: chuẩn bị runsc, agent và gateway; cấu hình credential qua nguồn trung tâm, kết nối PostgreSQL/Redis/S3 bằng mạng riêng, cache image đã duyệt, đăng ký worker ID riêng và allowlist URL của agent/gateway. Edge worker đồng bộ route về gateway riêng của VM chứa app. Chưa có tự cấp VM, live migration volume, HA control plane hoặc tự phục hồi worker mất dữ liệu. Không khởi động bản ghi dữ liệu trên VM khác nếu chưa fencing runtime cũ và phục hồi backup.

## Kiểm thử

```sh
npm run env:check
npm run check
npm run build:worker
npm run test:e2e
docker compose -p minintapp-refine-tests -f deploy/test.compose.yml up -d --wait
npm run test:platform
LOCAL_RUNTIME_IMAGE=minintapp-refine:local npm run smoke:runtime
```

`test:storage` cần MinIO test riêng ở loopback 19009 và bundle đã build; dùng credential fixture, không dùng key production. Bộ test Supabase live vẫn dùng cấu hình `vitest.supabase.config.ts` riêng, không được coi là đã kiểm thử nếu chưa có Supabase thật.

Các giới hạn còn lại: tenant ẩn danh gắn trình duyệt, marketplace/thanh toán chưa triển khai; live-data outbound trong sandbox mặc định bị chặn và cần egress proxy trước khi bật. Nhiều VM mới có contract/định tuyến, demo thực tế vẫn một VM. Xem [Business Flow](../business-flow.md) cho lộ trình thương mại.

Tham khảo: [gVisor installation](https://gvisor.dev/docs/user_guide/install/), [Docker firewall](https://docs.docker.com/engine/network/firewall-iptables/), [Traefik file provider](https://doc.traefik.io/traefik/reference/install-configuration/providers/others/file/).

## Demo đã kích hoạt (31/10/2026)

Profile platform đã bật trên VM demo; Worker nhận OpenAI key qua environment do systemd nạp từ file trung tâm. Control Plane không giữ key AI. Đã kiểm thử thật: tạo app bằng OpenAI, hai sandbox gVisor với hai subdomain HTTPS, lưu phiếu qua restart và suspend/resume mà app còn lại vẫn hoạt động. Đây là kiểm thử một VM, không phải xác nhận HA nhiều VM.

Probe gateway dùng HTTP request giữ nguyên `Host` để kiểm tra đúng app. Schema biểu thức AI dùng chuỗi `$defs`/`$ref` hữu hạn, giữ độ sâu biểu thức hiện tại và tránh schema inline vượt giới hạn Structured Outputs. Endpoint trạng thái lấy cấu hình AI từ Worker đã allowlist, không suy ra từ key của web. Lỗi quota tạo template trả JSON theo contract API.

## Migration PostgreSQL

`deploy/migrate-environment.mjs <file>` đổi tên secret nội bộ cũ tại chỗ, tạo URL chuẩn và giữ nguyên API key. File vẫn 0600; không tạo bản sao key trong repo hoặc thư mục deploy. Certbot nhận environment từ `deploy/certbot-environment.conf`.

Dừng riêng Worker trước khi chạy bundle `migrate-runtime-postgres.mjs <app-id> <image-digest>`. Script xác minh ownership, dừng runtime nguồn, đọc snapshot SQLite nhất quán từ volume chỉ đọc, backup private, nhập PostgreSQL và đối chiếu toàn bộ snapshot. Chỉ chuyển image sau health check; có rollback container cũ khi lỗi. Không xóa volume nguồn. Chạy lần lượt từng app rồi bật Worker; không dừng app không thuộc MinintApp. Không chạy script với database cluster dùng chung dịch vụ khác.

Role DB tách quyền dữ liệu, không tách tài nguyên vật lý của PostgreSQL. Connection limit và timeout mặc định không thay thế hard quota CPU/IO cho code SQL không đáng tin cậy. Prototype poll độc lập tại `runtime/poll/` vẫn là công cụ thử nghiệm SQLite, chưa được nối vào scheduler; sandbox do platform cấp dùng PostgreSQL.
