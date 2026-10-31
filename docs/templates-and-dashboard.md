# Thư viện mẫu và quyền truy cập dashboard

| Khu vực | Thiết kế và quyền truy cập |
| --- | --- |
| `/templates` | Mở cho khách; dùng logo/header, nền giấy, màu đỏ đất và kiểu chữ đồng bộ trang chủ. |
| Chọn mẫu | Chọn thời gian 1 giờ, 24 giờ hoặc 7 ngày; tạo app từ mẫu không gọi AI. |
| Mobile | Danh sách một cột, trường chọn cao ít nhất 44 px, hỗ trợ focus bàn phím. |
| `/dashboard` | Kiểm tra phiên trước khi tải danh sách; khách chuyển sang `/login`. Khi kiểm tra phiên lỗi, hiển thị thông báo và đường dẫn đăng nhập. |
| `/api/my-apps` | Trả 401 nếu chưa đăng nhập; vẫn giữ bộ lọc quyền sở hữu theo tài khoản và phiên trình duyệt hiện tại. |

App từng tạo ở trình duyệt khác cần được gắn tài khoản để xuất hiện trong cùng danh sách. Quyền host của các trang app và API thao tác triển khai vẫn được kiểm tra độc lập.
