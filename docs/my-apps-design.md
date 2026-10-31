# Giao diện ứng dụng của tôi

Trang `/my-apps` dùng header, logo và ngôn ngữ thiết kế của trang chủ: nền giấy sáng, chữ tối, điểm nhấn đỏ đất, đường viền nhẹ và khoảng cách thoáng.

| Khu vực | Hành vi |
| --- | --- |
| Tổng quan | Bốn số liệu độc lập với bộ lọc; hiển thị hai cột trên điện thoại. |
| Bộ lọc | Tìm theo tên/mã, trạng thái, hạn dùng và thứ tự; bố cục co giãn theo màn hình. |
| Danh sách | Nhãn trạng thái, hạn dùng, mở trang quản lý, gia hạn và kết thúc. |
| Chọn nhiều | Giữ xác nhận trước khi kết thúc và thông báo kết quả từng đợt. |
| Chưa có app | Có đường dẫn tạo ứng dụng mới ngay trong trạng thái trống. |

Nút và trường nhập có chiều cao tối thiểu 44 px, hỗ trợ bàn phím và giảm chuyển động. Không thay đổi API, quyền sở hữu hay dữ liệu ứng dụng.

Trang `/my-apps` dùng bố cục workspace với sidebar desktop, menu chung trên mobile và nút chính cam. Danh sách app tài khoản và các thao tác gia hạn/kết thúc vẫn dùng API cũ; không chuyển hướng sang danh sách triển khai khác. Lượt triển khai này bỏ qua test theo yêu cầu người dùng, chỉ build và xác minh production.
