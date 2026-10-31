# MinintApp — Project Write-up

**Ứng dụng nhỏ. Đúng lúc cần.**  
*Temporary problem. Temporary software.*

**Đội thi:** Team 35 — 95LAB (Hiếu Nd, Thức Nguyễn, Mai Phan)  
**Mã nguồn:** <https://github.com/95Lab/minintapp>  
**Demo:** <https://minintapp.io.vn/>

## 1. Vấn đề muốn giải quyết

Rất nhiều khoảnh khắc sinh hoạt nhóm cần một công cụ nhỏ để mọi người cùng tham gia, nhưng chỉ dùng trong vài giờ hoặc vài ngày:
- **Học tập:** Giáo viên hoặc nhóm dự án tạo nhanh một web app để thực hành theo nội dung bài học.
- **Họp nhóm:** Chốt nhanh địa điểm, lịch hẹn hay đồ uống mà không phải hỏi từng người trong nhóm chat.
- **Workshop:** Khởi động bằng một trò quiz, rồi mở từng câu hỏi lấy ý kiến theo nhịp buổi chia sẻ.
- **Lớp học:** Kiểm tra nhanh, thu khảo sát, bốc thăm người trả lời hoặc chia nhóm.
- **Quản lý chi tiêu chuyến đi:** Quay vòng chọn quán ăn, ghi lại từng khoản chi chung và theo dõi tổng chi.
- **Và mọi ý tưởng bất chợt:** Một form đăng ký, một mini game, một lần lấy ý kiến.

Điểm chung là **nhu cầu nảy sinh bất chợt, nhiều người cùng tham gia và vòng đời ngắn**. Công cụ có sẵn thường phải đăng ký, cấu hình hoặc mỗi việc lại cần một ứng dụng khác nhau; còn tự lập trình thì không đáng — không ai muốn xây cả một hệ thống cho một việc chỉ cần làm hôm nay.

## 2. Giải pháp đã xây dựng

MinintApp là nền tảng tạo và sử dụng **Flash Apps** — ứng dụng nhỏ, dùng ngay, kết thúc khi hết nhu cầu — từ mô tả bằng tiếng Việt hoặc tiếng Anh, hoặc từ mẫu có sẵn.

**Nói điều bạn cần (mô tả hoặc chọn mẫu) → Gửi link/QR, mời cả nhóm → Cùng tham gia, xem kết quả → Kết thúc khi hết nhu cầu**

Bản đang chạy trên demo gồm:

- **Tạo app bằng AI (OpenAI):** Người dùng trò chuyện với AI để làm rõ ý tưởng, chốt yêu cầu và chọn thời gian sử dụng 1 giờ, 24 giờ hoặc 7 ngày. AI chuyển yêu cầu thành cấu hình ứng dụng, được kiểm tra cấu trúc và quy tắc trước khi dựng giao diện từ các khối chức năng có sẵn.
- **7 mẫu dùng ngay, không cần AI:** Bình chọn, quiz, bốc thăm người tham gia, vòng quay lựa chọn, khảo sát nhiều trường, khảo sát từng bước và sổ chi tiêu.
- **Trải nghiệm người tham gia:** Mở link hoặc quét QR trên điện thoại/máy tính, không cần tài khoản; nhập tên hiển thị, gửi câu trả lời và xem kết quả cập nhật theo thời gian thực.
- **Trang quản lý cho chủ app:** Lấy link/QR, theo dõi câu trả lời; đóng, mở lại hoặc kết thúc app; thao tác riêng cho quiz (bật mí đáp án) và bốc thăm; gia hạn, xuất CSV và remix — mô tả thay đổi bằng lời để AI tạo phiên bản mới từ app và kết quả hiện tại.
- **Không gian "Ứng dụng của tôi":** Thống kê tổng số app, đang hoạt động, đang triển khai và cần chú ý (lỗi hoặc hết hạn); tìm theo mã hoặc tên miền, lọc theo trạng thái; truy cập nhanh thư viện mẫu.
- **Nền tảng vận hành:** Dữ liệu lưu bền trên Supabase và đồng bộ Realtime giữa các thiết bị; lớp Control Plane, hàng đợi và Worker quản lý sandbox cùng dữ liệu riêng cho từng app. Giao diện song ngữ Việt/Anh, tối ưu cho di động.

Phạm vi app tạo được bằng AI phụ thuộc vào các khối chức năng và quy tắc runtime đang hỗ trợ.

## 3. Định hướng phát triển phù hợp

**Option 2 — AI-Native Products & Operations.**

AI chuyển mô tả nhu cầu thành một ứng dụng hoạt động được; nền tảng lo giao diện, dữ liệu, chia sẻ và vòng đời. Người không biết lập trình có thể tạo công cụ riêng cho hoạt động của mình mà không phải thiết lập hạ tầng — bạn lo ý tưởng, MinintApp lo chỗ để mọi người cùng tham gia.

Bước tiếp theo, nhóm mở rộng thư viện khối chức năng để phục vụ các tình huống phức tạp hơn: phân ca chăm sóc người thân, đăng ký phiên workshop giới hạn chỗ và check-in, đặt món theo đoàn, hay quản lý đơn hàng – tồn kho cho gian hàng hội chợ cuối tuần.

## 4. Cách sử dụng Codex

Nhóm sử dụng Codex để:

- Phân tích nghiệp vụ, chia task và thiết kế contract giữa AI, backend và giao diện.
- Phát triển giao diện sản phẩm, API, adapter dữ liệu và các thành phần triển khai.
- Viết kiểm thử, rà soát thay đổi, hỗ trợ sửa lỗi và chuẩn bị tài liệu.

Mỗi task có phạm vi và tiêu chí nghiệm thu rõ ràng; thành viên phụ trách review kết quả và chạy kiểm tra phù hợp. Codex hỗ trợ quá trình phát triển; luồng tạo app trong sản phẩm sử dụng OpenAI.
