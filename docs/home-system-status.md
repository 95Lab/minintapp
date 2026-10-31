# Menu và trạng thái hệ thống

| Khu vực | Hành vi |
| --- | --- |
| Menu desktop/mobile | Có liên kết “Thư viện component” tới `/preview`. |
| Cuối trang chủ | Khối trạng thái nền tảng thay cho liên kết health đơn thuần, kèm thời điểm kiểm tra và đường dẫn chi tiết. |
| Cập nhật | Đọc `/api/health` khi mở trang, mỗi phút khi trang đang hiển thị và khi quay lại tab; timeout 8 giây. |
| Kết quả | Phân biệt đang kiểm tra, hoạt động bình thường, tạm gián đoạn và chưa thể xác nhận. Không hiện bình thường khi request lỗi. |
| Ngôn ngữ | Nội dung, nhãn menu và giờ kiểm tra hỗ trợ Việt–Anh. |

Đây là kết quả kiểm tra của endpoint nền tảng, không phải cam kết sức khỏe của mọi tích hợp bên ngoài hay từng sandbox.

Footer được rút gọn còn logo, 95LAB và trạng thái hệ thống; các liên kết điều hướng đã có trong menu. FAQ dùng cách diễn đạt quản lý ứng dụng sau khi tạo.
