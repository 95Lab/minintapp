# Contract deployment và job

Metadata cho Control Plane, tách khỏi `AppRecord.status` (`active/closed/ended/blocked`). Đóng nhận câu trả lời không đồng nghĩa dừng container. Một app có thể có lịch sử nhiều deployment; mỗi deployment gắn một snapshot spec và một phiên bản template bất biến.

## Phạm vi đã triển khai

- Schema Zod/type ở `src/lib/deployments/deployment-schema.ts`.
- Quy tắc chuyển trạng thái ở `src/lib/deployments/deployment-state.ts`.
- Contract repository ở `src/lib/db/deployments-repository-types.ts`.
- Memory adapter cho local và Supabase adapter lưu bền; chọn bằng `APP_STORAGE`, không fallback khi database lỗi.
- Migration `supabase/migrations/202610310003_deployments.sql`. Áp dụng sau các migration trước đó; chỉ service role được đọc/ghi/RPC, không broadcast metadata ra client.
- Test state machine và migration thật trên PostgreSQL nhúng. Đây chưa phải kiểm thử Supabase project thật.

Chưa có build worker, hàng đợi, lease/heartbeat, Docker/gVisor, DNS, gateway, API công khai hoặc tự nối vào nút tạo app. `command` chỉ ghi nhận metadata đã được worker xác nhận; không thực hiện tác động hạ tầng. Không coi `cleanupConfirmed` hay `verifiedUrl` là phép kiểm tra tự động. Worker tương lai phải thực sự kiểm tra trước khi gửi lệnh.

## Dữ liệu

| Trường | Ý nghĩa |
|---|---|
| `id`, `appId`, `version` | Định danh deployment, app nguồn, version optimistic lock |
| `idempotencyKey` | Khóa yêu cầu tạo, duy nhất trong phạm vi app |
| `specHash`, `templateVersion` | SHA-256 của snapshot spec được chốt và phiên bản template; bên gọi phải giữ đúng snapshot để build, không đọc spec mới nhất thay thế |
| `hostname` | FQDN chữ thường, được giữ chỗ đến khi cleanup hoàn tất; chưa đồng nghĩa DNS đã tồn tại |
| `imageRef` | Image theo digest `registry/repository@sha256:…`, không chấp nhận mutable tag |
| `workerId`, `sandboxId`, `volumeId`, `dnsRecordId` | Tham chiếu nội bộ; nullable khi chưa được cấp; có thể ghi từng phần để phục vụ cleanup sau lỗi |
| `expiresAt`, `createdAt`, `updatedAt`, `deletedAt` | Unix milliseconds; `deletedAt` chỉ được ghi sau xác nhận thu hồi tài nguyên |
| `gatewayVerifiedAt` | Thời điểm worker xác nhận URL HTTPS qua gateway; xóa xác nhận khi suspend/expire/retry |
| `job` | ID ổn định qua retry, trạng thái, attempt/maxAttempts, thời điểm bắt đầu/kết thúc |
| `lastError`, `errors` | Mã lỗi, stage, attempt, thời điểm, retryable; giữ lịch sử tối đa 10 attempts; không lưu log/raw exception/secret |

Không có credentials, host token, quiz answers, source code hoặc registry token trong record. Không trả nguyên record này cho participant. Tầng API sau này phải xác thực host/owner và dùng DTO public được thiết kế riêng. Repository là giao diện nội bộ tin cậy, không tự thực hiện xác thực hoặc kiểm tra app tồn tại/hết hạn; tầng điều phối phải kiểm tra và chốt spec, thời hạn app trước khi tạo deployment. Không dùng hostname hợp lệ theo cú pháp làm bằng chứng domain thuộc hệ thống: khi provisioning phải kiểm tra domain runtime được quản lý và tách domain dashboard.

Không có foreign key sang app snapshot: bản ghi deployment cần tồn tại để cleanup cả khi app nguồn đã bị retention xóa. Không tự đồng bộ thời hạn khi app được gia hạn; đây là thao tác điều phối riêng chưa được triển khai.

## State machine

```text
QUEUED → GENERATING → BUILDING → DEPLOYING → RUNNING ⇄ SUSPENDED
             ↓          ↓          ↓
           FAILED ←─────┴──────────┘
             ↓ retry (nếu retryable và còn lượt)
           QUEUED

Mọi state còn sống → EXPIRED khi đến expiresAt
FAILED / SUSPENDED / EXPIRED → DELETED sau cleanup xác nhận
```

- `start` claim job bằng version hiện tại, tăng attempt và đặt worker. Lượt đầu là 1.
- `build` ghi nhận bắt đầu build; `deploy` chỉ nhận image digest bất biến.
- `resources` ghi riêng từng sandbox/volume/DNS ID. ID đã ghi không được thay bằng ID khác. Worker không được đổi khi đã có sandbox hoặc volume.
- `ready` chỉ chuyển `DEPLOYING → RUNNING` khi đủ image/worker/sandbox/volume/DNS và worker xác nhận chính xác `https://<hostname>/`.
- `fail` chỉ dùng ở GENERATING/BUILDING/DEPLOYING, mã lỗi phải phù hợp stage. Retry giữ resource IDs để worker reconcile theo deployment ID, không tự tạo bản sao. Nếu đã có sandbox thì không được đổi image trong retry; muốn image mới phải tạo deployment mới.
- `suspend`/`resume` ghi trạng thái runtime; job build/deploy vẫn `SUCCEEDED`. Resume yêu cầu kiểm tra lại URL gateway.
- `expire` hủy job chưa hoàn tất thành `CANCELLED`; job đã kết thúc giữ trạng thái cũ. Worker đến muộn không thể tiến pipeline sau TTL.
- `delete` chỉ sau xác nhận cleanup; hostname chỉ được tái sử dụng sau `DELETED`. Record và error history được giữ lại. Muốn xóa app đang chạy, trước hết dừng workload, ghi `suspend`, thu hồi tài nguyên rồi `delete`.

Các lệnh terminal/advance không tự replay. Hai worker dùng cùng version: chỉ một lệnh thành công. Nếu response bị mất, đọc lại để reconcile; không tự retry mutation mù vì thao tác có thể đã commit. Đây chưa thay thế lease/queue hoặc giao thức worker có fencing token ở tầng hạ tầng.

## Sử dụng phía server

```ts
import { deploymentsRepository } from "@/lib/db/deployments-repository";

const repo = deploymentsRepository();
const { deployment } = await repo.create({
  appId, idempotencyKey, hostname,
  specHash, templateVersion: "poll-v1", expiresAt,
});
const claimed = await repo.command(deployment.id, deployment.version, {
  type: "start", workerId: "worker-01",
});
```

Type được suy ra từ Zod; không khai báo lại ở component. Có thể dùng `find(id)` và `listByApp(appId)` để reconcile/lấy lịch sử. Với Supabase, RPC kiểm tra version dưới row lock và các ràng buộc ở transaction boundary. Tạo lại cùng app/key/intent trả record gốc, kể cả deployment đã hết hạn/xóa; cùng key khác intent trả `idempotency_conflict`. Hostname đang giữ chỗ trả `hostname_conflict`. Mã lỗi chuyển trạng thái gồm `not_found`, `version_conflict`, `invalid_transition`, `expired`, `attempts_exhausted`. Lỗi transport/payload database được che bằng `storage_unavailable`.

## Kiểm tra

```sh
npx vitest run tests/unit/deployments.test.ts tests/unit/deployments-postgres.test.ts
npm run env:check
npm run check
```

Không đổi route/UI hoặc runtime configuration trong hạng mục này; các API hiện tại tiếp tục chạy theo contract app cũ.
