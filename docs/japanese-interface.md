# Giao diện tiếng Nhật

| Phần | Hành vi |
| --- | --- |
| Chuyển ngôn ngữ | VI / EN / 日本語; lưu cookie, đồng bộ HTML lang và khôi phục khi tải lại. |
| Nội dung chính | Trang chủ, menu, mẫu, đăng nhập, quản lý app, hướng dẫn và trạng thái có bản dịch Nhật. |
| Typography | Font hệ thống Nhật, ngắt dòng và line-height phù hợp; giữ vùng chạm trên mobile. |
| Nội dung app | Ngôn ngữ giao diện tách khỏi spec app. Nội dung app đã tạo vẫn giữ Việt/Anh; chọn Nhật không thay đổi dữ liệu app. |
| Fallback | Chuỗi giao diện chưa có bản dịch Nhật dùng tiếng Anh; không giả định bản dịch nội dung do người dùng nhập. |

Từ điển `japanese.ts` ánh xạ chuỗi giao diện tiếng Anh sang Nhật; `localize` dùng chung cho component và bản dịch server. Không thay schema app, API, phiên đăng nhập hay credentials.
