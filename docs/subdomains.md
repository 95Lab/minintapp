# Địa chỉ app: ngẫu nhiên và tên riêng

| Chế độ | Hành vi |
| --- | --- |
| Ngẫu nhiên | Mặc định, dùng ID 24 ký tự hex, giữ tương thích app hiện có. |
| Tên riêng | Nhãn “Tính năng nâng cao”, chọn khi chốt tạo bằng AI hoặc trước khi tạo từ mẫu. |
| Tên hợp lệ | 3–40 ký tự ASCII a–z/0–9/gạch ngang; không bắt đầu/kết thúc bằng gạch ngang; chặn tên hệ thống, tên dạng ID và tên nhiều cấp. |
| Kiểm tra | Giao diện debounce; server kiểm tra database và DNS qua worker có bearer token. 30 lượt kiểm tra/phút/IP. Không gửi Cloudflare token ra web. |
| Chống trùng | Khóa giao dịch, unique hostname và kiểm tra DNS trước khi đặt tên. Idempotency giữ nguyên hostname đã cấp. |
| DNS | CNAME trỏ ingress, chỉ cập nhật/xóa record có marker `minintapp:<app-id>`, từ chối nếu có bất kỳ record khác sở hữu tại tên đó. |
| URL | Link chia sẻ/QR và redirect participant dùng hostname đã cấp; quyền host vẫn ở nền tảng, không gắn token vào URL cross-origin. |
| Runtime | Nhận hostname riêng qua môi trường; không ảnh hưởng IP, network hoặc app có sẵn. |

Phạm vi custom DNS `*.minintapp.io.vn` đã được người dùng cho phép trong phiên làm việc. Giữ nguyên record gốc, record ngoài sở hữu và ingress. Chưa hỗ trợ đổi hostname sau khi tạo hoặc tự tái sử dụng tên đã có trong lịch sử deployment. Kiểm tra “có thể sử dụng” không giữ chỗ; server kiểm tra lại lúc tạo và worker vẫn từ chối ghi đè nếu DNS thay đổi đồng thời.

Môi trường không có control plane sẽ chỉ cho dùng tên ngẫu nhiên; request custom trực tiếp vào engine bị từ chối. Nội dung hỗ trợ Việt/Anh/Nhật. Không có bước tạo DNS thật trong unit/E2E dùng mock.
