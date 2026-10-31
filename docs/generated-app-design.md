# Tiêu chuẩn giao diện ứng dụng được tạo

Áp dụng chung cho `/rooms`, `/a` và bản poll runtime độc lập. Ưu tiên điện thoại, nội dung dễ đọc, một nhiệm vụ chính và nút rõ hành động. Các app dùng khối có sẵn nhận giao diện chung khi tải phiên bản runtime mới.

| Thành phần | Tiêu chuẩn |
| --- | --- |
| Màu và chữ | Nền giấy sáng, chữ tối, điểm nhấn trầm theo theme; kiểu chữ hệ thống/Geist. Giao diện rooms giữ chế độ sáng thống nhất. |
| Bố cục | Nội dung người tham gia tối đa 600 px; host chia hai cột trên màn hình lớn và một cột trên điện thoại. |
| Tương tác | Nút tối thiểu 44 px, trường nhập 48 px, chữ form 16 px; focus bàn phím rõ ràng. |
| Nội dung dài | Tự xuống dòng; bảng cuộn trong vùng riêng, không kéo rộng trang. |
| Trạng thái | Giữ phản hồi đã gửi, lỗi, vô hiệu hóa và quyền host hiện có. |
| Mini game tùy biến | Có style nền trong iframe và hướng dẫn AI tạo giao diện 320 px, label rõ, tương phản tốt, giảm chuyển động. CSS do AI viết vẫn có thể ghi đè style nền. |
| Runtime độc lập | Poll dùng cùng màu, khoảng cách và vùng chạm. |

Không đổi dữ liệu app hoặc contract API. App trong sandbox đang chạy image cũ cần được triển khai lại image mới để nhận CSS mới. Style nền không thể bảo đảm mọi HTML tùy biến đẹp nếu app tự đặt CSS riêng; các app này vẫn cần kiểm tra từng trường hợp.
