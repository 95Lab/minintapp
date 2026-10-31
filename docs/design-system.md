# Giao diện nền tảng

Home và logo `m· / minintapp.` là chuẩn nhận diện. `BrandLogo` dùng chung cho home, login, sidebar dashboard và header runtime; `SiteHeader` dùng chung cho home, thư viện mẫu, trang tài khoản và các màn có top bar.

Triết lý tối giản Nhật được thể hiện qua khoảng trống có chủ đích, nền giấy ấm, chữ màu mực, một màu nhấn đỏ đất và đường viền nhẹ. Không dùng ký tự Nhật trang trí hoặc thay đổi chức năng để tạo phong cách. Tập trung vào thao tác chính và thông tin dễ đọc.

- Nút đăng nhập luôn hiện trên home khi chưa có phiên, kể cả lúc đang tải trạng thái. Phiên đăng nhập hợp lệ thay nút bằng menu tài khoản.
- Mobile có logo, đăng nhập và nút menu dễ chạm. Điều hướng, ngôn ngữ và tạo app nằm trong menu; Escape đóng menu và trả focus về nút mở.
- Nút chính cao tối thiểu 44 px; ô nhập mô tả dùng font 16 px trên điện thoại để tránh zoom ngoài ý muốn. Không tràn ngang ở 320/390 px.
- Dùng chữ Việt/Anh, trạng thái focus rõ và tôn trọng giảm chuyển động. Màu nội dung/theme của từng app vẫn thuộc AppSpec.

Kiểm thử trình duyệt bao gồm đăng nhập hiển thị, menu mobile, bàn phím, ngôn ngữ và trạng thái đã đăng nhập. Không cần kết nối provider để kiểm tra giao diện.
