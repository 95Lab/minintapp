# MinintApp — Triển khai trên VM dùng chung

[Tiếng Việt](deployment.md) | [English](deployment.en.md)

## Trạng thái

Repo có khung CI/CD, chưa có source ứng dụng hoặc Dockerfile. Workflow cố ý dừng nếu thiếu Dockerfile. Chưa cài workflow credential, tạo network, sửa Nginx hay deploy lên server. Cần merge nhánh này vào `main` trước khi push lên `main` kích hoạt workflow.

## Hợp đồng deploy

- App cung cấp Dockerfile, Node.js runtime, lắng nghe `0.0.0.0:3000`, endpoint `/healthz` trả HTTP 2xx chỉ khi sẵn sàng.
- Image chạy với UID/GID 1000, filesystem chỉ đọc, chỉ `/tmp` được ghi. Dữ liệu bền vững phải bổ sung volume riêng và migration tương thích rollback khi triển khai backend.
- Compose project cố định `minintapp`; chỉ publish `127.0.0.1:18080`. Nginx hiện có giữ cổng 80/443, chuyển tiếp domain MinintApp vào cổng nội bộ này. Cấu hình Nginx/TLS cần chuẩn bị và kiểm tra trước khi bật CI/CD.
- Network `minintapp-platform`, subnet dự kiến `172.30.240.0/24`, có nhãn sở hữu. Preflight kiểm tra mọi network Docker và route IPv4 trước deploy; có xung đột thì dừng, không sửa network của app khác. Docker tự cấp IP, không gán IP tĩnh cho container.
- Không chạy `docker system prune`, xóa volume, `compose down` hoặc restart Docker/Nginx từ pipeline. Không dùng host network, privileged mode hoặc mount Docker socket vào web.
- Web bị giới hạn 1 CPU / 768 MiB RAM, PID và log; trước build cần ít nhất 10 GiB trống. Chạy một deploy tại một thời điểm. Build vẫn có thể gây tải I/O/CPU chung; muốn bảo đảm tài nguyên mạnh hơn cần worker build riêng hoặc cgroup dành riêng được kiểm chứng.

Network bridge riêng chỉ là một phần cách ly. Trước khi chạy Flash App do người dùng tạo, phải bổ sung gVisor, chính sách firewall/egress chặn host, mạng nội bộ và app khác, quota tổng sandbox, cùng bộ cấp subnet có khóa kiểm tra xung đột. Khung hiện tại chỉ deploy nền tảng web, chưa tạo sandbox hay bảo đảm cách ly network cho code không đáng tin cậy.

## Thiết lập một lần

1. Tạo user deploy và `/opt/minintapp` có quyền phù hợp. Quyền Docker có mức ảnh hưởng tương đương root, chỉ cấp cho credential triển khai tin cậy. Không dùng private key cá nhân đang SSH từ máy này làm CI key.
2. Tạo key CI riêng, thêm public key vào user deploy. Trong GitHub Environment `production`, thêm secret `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS` (host key của `[116.118.45.242]:2299`, xác minh fingerprint qua kênh tin cậy).
3. Thêm environment variables `DEPLOY_HOST=116.118.45.242`, `DEPLOY_PORT=2299`, `DEPLOY_USER=<user deploy>`.
4. Bổ sung source và Dockerfile đúng hợp đồng; cấu hình secret runtime trên server và volume khi backend cần. Không đưa secret vào image hoặc git archive.
5. Kiểm tra subnet, tài nguyên và Nginx; cấu hình HTTPS/domain. Bật bảo vệ nhánh `main` và chỉ merge thay đổi đã kiểm tra.

## Luồng cập nhật

Push/merge vào `main` → kiểm tra hợp đồng → upload source đúng SHA → khóa deploy trên server → kiểm tra subnet/đĩa → build image gắn SHA → cập nhật riêng project MinintApp → health check → lưu image hiện hành.

Nếu health check lỗi, thử khôi phục image trước đó. Khung này có thể có downtime khi recreate container, chưa phải blue-green. Rollback hiện chỉ phục hồi image với Compose hiện tại, không tự phục hồi migration, volume hoặc thay đổi cấu hình; khi schema/config thay đổi cần kế hoạch rollback riêng. Lần deploy đầu lỗi thì dừng container web mới. Không tự dọn image cũ hoặc dữ liệu dịch vụ khác.

“Tự sync” ở đây là upload snapshot commit, không `git pull` ghi đè thư mục đang chạy. Secret và dữ liệu phải nằm ngoài thư mục release.
