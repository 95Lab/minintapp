# Triển khai MinintApp trên VM dùng chung

[Tiếng Việt](deployment.md) | [English](deployment.en.md)

Khi bật Control Plane và sandbox riêng, xem [Kiến trúc runtime](architecture-runtime.md). Pipeline cập nhật cả Worker bundle đặc quyền và web image; database/queue/storage giữ nguyên.

## Luồng triển khai

Push vào `main` → typecheck/unit/build/E2E → build và smoke image trên GitHub → publish GHCR theo digest → SSH bằng user `minintapp-deploy` → pull image → health check nội bộ và HTTPS → lưu phiên bản hoặc rollback.

Không cần self-hosted runner. Build không chạy trên VM. Mặc định `APP_STORAGE=memory`: deploy/restart/rollback làm mất app và vote. Để lưu bền, cấu hình `APP_STORAGE=supabase` và các key trong `deploy/.env.app`, áp dụng migration theo [Supabase](supabase.md); không cần thay đổi image build. Chưa có AI key thì tạo app bằng template; không giả lập AI thật.

## Cách ly trên server

Nginx hiện có giữ 80/443; MinintApp chỉ bind `127.0.0.1:18080`. Compose project `minintapp`, network `minintapp-platform`, subnet `172.30.240.0/24`. Preflight so sánh subnet với Docker networks và route trước mỗi deploy, xung đột thì dừng. Docker tự cấp IP. App giới hạn 1 CPU/768 MiB RAM và log. Không restart Docker, không prune, không sửa stack khác.

Đây là nền tảng web dùng chung runtime hiện tại, chưa triển khai mỗi Flash App một sandbox. Trước khi chạy code không đáng tin cậy cần gVisor, kiểm soát egress và quota sandbox. Network riêng không phải toàn bộ ranh giới bảo mật.

## Credential

Repository secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_KNOWN_HOSTS`. Variable `VPS_PORT=2299`, `DEPLOY_ENABLED=true` chỉ sau bootstrap. Environment `production`.

Key CI riêng không được đăng nhập root, mở shell, upload file hoặc gọi Docker tùy ý. Authorized key dùng forced command; sudo chỉ cho gate root-owned `/usr/local/sbin/minintapp-ssh-gate`, gate chỉ chấp nhận `deploy ghcr.io/95lab/minintapp@sha256:<64 hex>`. Credential này có thể thay ứng dụng MinintApp; chỉ cấp workflow tin cậy trên main. Token GHCR nhận qua stdin, Docker config tạm bị xóa sau lệnh.

## Bootstrap và thay đổi hạ tầng

Admin cài `deploy/compose.yml`, `deploy/deploy.sh`, `deploy/network-preflight.py` vào `/opt/minintapp` và `deploy/ssh-gate.sh` vào `/usr/local/sbin/minintapp-ssh-gate`, tất cả root-owned. User CI không có quyền sửa các file này hoặc membership Docker. Admin tạo network sau khi preflight thành công; cấu hình Nginx domain và chứng chỉ TLS. Secret runtime giữ trong `.env.app` mode 600; `.env` chứa `APP_ORIGIN=https://minintapp.io.vn`.

Pipeline chỉ cập nhật image ứng dụng, không tự cập nhật file hạ tầng root-owned. Nếu thay Compose/gate/deploy script, admin phải kiểm tra và cài phiên bản mới trước khi bật workflow tương ứng. Không dùng `scripts/deploy-runner.sh` cho mô hình SSH này.

## Kiểm tra và rollback

`curl --fail https://minintapp.io.vn/api/health` phải trả service `minintapp`. Image chỉ promote sau khi health nội bộ và public thành công. Nếu lỗi, script thử khôi phục image cũ; lần đầu không có image cũ thì dừng app. Có downtime khi recreate. Rollback không phục hồi memory, migration hoặc cấu hình hạ tầng.

Certbot quản lý chứng chỉ origin, renewal hook kiểm tra rồi reload Nginx. Giữ route ACME trên HTTP cho renewal. Cloudflare DNS/TLS policy không được pipeline tự thay đổi.
