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
| Dữ liệu app | `src/lib/runtime-plane/` | Một SQLite trên volume riêng cho mỗi app |
| Artifact / backup | `platform/artifacts.ts`, `platform/backup.ts` | Manifest và snapshot SQLite nhất quán trên S3-compatible storage |

## Luồng tạo app

1. Browser có tenant capability trong cookie HttpOnly; HTTPS dùng prefix `__Host-`. Tài khoản Supabase đã xác thực có thể tiếp tục được nhận diện qua engine.
2. Control Plane ghi deployment vào PostgreSQL với host token hash, image digest, TTL và idempotency key. Trả `202`; frontend theo dõi trạng thái trước khi mở app. Luồng engine generation giữ NDJSON tiến độ.
3. Outbox được dispatcher đẩy vào BullMQ với job ID cố định. Crash sau khi enqueue không tạo job trùng.
4. Scheduler khóa transaction để đặt chỗ, chỉ chọn worker heartbeat còn mới, còn capacity và đã cache đúng image digest.
5. Builder sinh/validate AppSpec. Artifact là **image template bất biến + manifest AppSpec**, không chạy npm build cho code backend tùy ý do người dùng sinh. `BUILDING` là bước đóng gói manifest. Pipeline build code không đáng tin cậy trong sandbox tạm là phần mở rộng riêng, chưa được bật.
6. Agent tạo sandbox, gắn SQLite volume, kiểm tra health, thêm route và DNS trong phạm vi đã phê duyệt. Chỉ chuyển `RUNNING` sau khi kiểm tra cả gateway nội bộ và HTTPS công khai đúng app ID.

## Cách ly và dữ liệu

- Runtime chỉ nhận seed và capability của chính app đó; không nhận API key OpenAI, Cloudflare, S3, database chung hoặc Docker socket.
- Container non-root, `runsc`, filesystem chỉ đọc, `/tmp` giới hạn, 0,5 CPU/512 MiB, giới hạn PID, log và SQLite page count. Một app chạy một replica.
- Mỗi app có bridge riêng, tắt IPv6 và DNS ra ngoài. Kiểm tra subnet với Docker và mọi route IPv4; chọn cổng loopback chưa được socket hoặc container nào đặt trước. Cổng được giữ cố định qua restart.
- Rule INPUT và DOCKER-USER chỉ khớp bridge của app, chặn kết nối NEW ra host/mạng khác; không đổi chính sách firewall của app cũ. Không có fallback sang runc nếu runsc không khả dụng.
- Trước cấp runtime mới, giữ ít nhất 1,5 GiB RAM khả dụng và 10 GiB đĩa trên host. Capacity mặc định 3 app/VM; quota global mặc định 3 và mỗi tenant 2 app. Các giới hạn cần đo lại theo tải thật.
- SQLite WAL + synchronous FULL; chỉ cập nhật cache memory sau khi ghi thành công. Engine dùng compare-and-swap theo `stateVersion`, retry conflict và giữ bất biến app ID/host credential.
- Backup `VACUUM INTO` mỗi 5 phút, upload vào bucket private. Hết hạn dừng runtime/xóa route và DNS, giữ volume 24 giờ rồi xóa volume cùng artifact. Xóa chủ động bỏ thời gian lưu giữ. Rollback image không khôi phục dữ liệu đã xóa.

## Credential và DNS

Worker đọc trực tiếp `~/.config/ai-secrets/api.env`, mặc định `/root/.config/ai-secrets/api.env` trên VM. Không tạo file bản sao API key. Control Plane chỉ nhận credential nội bộ cần thiết qua environment, sandbox không nhận các key nền tảng.

Các secret nội bộ `MININTAPP_POSTGRES_PASSWORD`, `MININTAPP_REDIS_PASSWORD`, `MININTAPP_WORKER_TOKEN`, `MININTAPP_SIGNING_SECRET`, `MININTAPP_S3_ACCESS_KEY_ID`, `MININTAPP_S3_SECRET_ACCESS_KEY` được lưu cùng file trung tâm; không đưa giá trị vào Git hoặc log. Nếu đổi worker token, phải rollout lại capability của runtime hiện có, không chỉ sửa file rồi restart agent.

`DNS_AUTOMATION_APPROVED` mặc định false. Phạm vi demo được chủ hệ thống phê duyệt: ingress A, CNAME app ID 24 hex dưới `minintapp.io.vn` và TXT ACME tạm để cấp/gia hạn wildcard TLS. Record khác không được sửa. `deploy/acme-cloudflare.py` chỉ đụng TXT có nội dung validation và nhãn sở hữu tương ứng.

## Deploy và nhiều VM

`deploy/platform.compose.yml` là overlay lên Compose web hiện có. PostgreSQL, Redis và MinIO dùng volume riêng; chỉ bind loopback. Nginx hiện tại giữ 80/443, chuyển app hostname đến Traefik loopback 18081. Agent bind bridge/private IP 19090 và yêu cầu bearer token.

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
