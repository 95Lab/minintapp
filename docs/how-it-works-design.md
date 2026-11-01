# Thiết kế Cách hoạt động

| Thành phần | Quy tắc |
| --- | --- |
| Màu | Khai báo token ngay trong component để hiển thị đúng cả trang chủ và trang `/how-it-works`; không phụ thuộc wrapper trang chủ. |
| Tạo ứng dụng | Nút chính nền mực, chữ trắng, tương phản rõ. |
| Live Demo | Nút phụ nền trắng, chữ tối, viền nhẹ. |
| Khám phá mẫu | Liên kết bổ sung đặt sau hai hành động chính. |
| Mobile | Nút từ 44–48 px; xếp dọc ở màn hình nhỏ, không tràn ngang. |
| Khả năng truy cập | Focus bàn phím rõ; bước đang chọn có nền, viền và số thứ tự; hỗ trợ giảm chuyển động. |

Dùng chung cho nội dung Việt–Anh, không thay đổi logic tạo hoặc quản lý app.

Trang `/how-it-works` được thiết kế lại độc lập: một H1, ba bước tĩnh ngắn gọn, demo bình chọn/quiz chạy trong trình duyệt và QR dẫn về chính trang demo. Bỏ toàn bộ form tạo, đăng nhập, remix chưa kết nối và các placeholder mở rộng khỏi trang này. Demo có kết quả thật theo lựa chọn cục bộ và nút reset; không gửi câu trả lời lên server. Hỗ trợ đầy đủ Việt/Anh/Nhật cho nội dung trang.
