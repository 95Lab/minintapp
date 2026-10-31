# Runtime đầy đủ

## Điểm vào

- Trang chủ tạo bằng OpenAI; `/templates` mở các mẫu có sẵn không cần gọi AI.
- `/rooms/:id/host` điều khiển; `/rooms/:id` tham gia; `/my-apps` quản lý phòng sau đăng nhập.
- `/login` gửi magic link, `/auth/callback` hoàn tất đăng nhập. Thêm origin triển khai và URL callback này vào Supabase Auth URL Configuration.
- Host của phòng cũ có nút mở giao diện đầy đủ. API `/api/apps/` và link `/a/` tiếp tục phục vụ phòng cũ.

## Cấu trúc

`src/engine/app-spec`, `blocks`, `responses` và `generation` chứa contract/runtime đầy đủ. `src/engine-ui` chứa renderer, input/view và màn hình host/participant. Zod kiểm tra spec, payload và cấu hình liên trường. API ở `src/app/api/engine`; không đưa SDK hoặc service key vào client.

Adapter `src/engine/db/apps-repository.ts` ghi qua repository snapshot trong `src/lib/db`. Metadata báo cáo/ảnh nằm trong extension của snapshot; mutation dùng CAS và broadcast cùng giao dịch. Ảnh nằm trong bucket Supabase Storage riêng tư `minint-photos`, tạo khi upload lần đầu. Kết thúc phòng xóa answers/runtime/payee và yêu cầu xóa ảnh tương ứng. Khi xóa blob gặp lỗi hoặc phòng chỉ hết hạn, chạy `npm run supabase:cleanup` để xem trước, rồi `npm run supabase:cleanup -- --apply` để dọn blob mồ côi; SQL cleanup không xóa file Storage. Script chỉ dọn thư mục phòng đã kết thúc/bị chặn, không còn snapshot, hoặc đã hết hạn ít nhất 10 phút; mỗi lượt tối đa 2.000 thư mục. Lên lịch lệnh có `--apply` mỗi 10 phút trên máy có môi trường server để dọn cả file lẫn dữ liệu SQL.

Host token không lưu localStorage. Cookie HttpOnly cấp quyền API; màn hình host gửi `x-host-session: 1`, nên mở link participant trong cùng trình duyệt vẫn nhận dữ liệu participant. Tài khoản đã nhận quyền phòng có thể điều khiển trên thiết bị khác. Không chia sẻ host token hoặc cookie.

## Môi trường và migration

Chạy cả hai migration theo thứ tự trong `supabase/migrations/`. Migration thứ hai thêm rate limit dùng chung, security log và cleanup. Nếu chưa bật `pg_cron`, lên lịch gọi RPC `minint_cleanup` bằng service role. Không công khai endpoint service role.

Đặt `APP_ORIGIN` đúng URL HTTPS bên ngoài, `IP_HASH_SALT` ngẫu nhiên và giữ `ENABLE_SIMULATE=0`. Reverse proxy phải ghi đè header IP từ client để rate limit/báo cáo không tin IP giả. `PRESENTER_KEY` chỉ dành cho buổi trình diễn, không chia sẻ cho participant.

`LIVE_DATA=off` hiển thị dữ liệu mẫu có nhãn; bật `LIVE_DATA=on` để dùng nguồn thời tiết/tỷ giá. Đây không phải dữ liệu giao dịch tài chính. VietQR chỉ tạo thông tin thanh toán và trạng thái tự xác nhận, chưa có kết nối ngân hàng xác minh tiền đã đến.

Custom block chạy iframe sandbox chỉ cho script, CSP không cho kết nối mạng. Không cấp same-origin, form hoặc quyền điều hướng trang cha. Trang sandbox không mở trực tiếp như một app độc lập.

## AI và kiểm tra

Chỉ OpenAI Responses với Structured Outputs, `store:false`, kiểm tra Zod, sửa output có giới hạn và deadline. Homepage nhận JSON để đặt cookie ngay; thư viện mẫu hỗ trợ NDJSON tiến độ, sau đó đổi token lấy cookie cùng origin. Remix truyền spec và kết quả đã tổng hợp vào OpenAI. Thiếu key trả lỗi cấu hình, không chuyển sang sinh dữ liệu giả.

Chạy `npm run env:check`, `npm run check`, `npm run test:e2e`; chạy `npm run supabase:test` riêng khi đã cấu hình project thật. E2E dùng memory và giả lập endpoint AI/WebSocket, không phát sinh phí AI hoặc email. Muốn xác nhận dịch vụ bên ngoài cần thử một lần generate/remix thật và magic link trên domain triển khai; không dùng kết quả mock để khẳng định các dịch vụ đó hoạt động.

## Dashboard người tạo app

`/my-apps` hiển thị tổng số app hiện có, app đang chạy, đã đóng và hết hạn trong 7 ngày. Có tìm theo tên/mã (không dấu), lọc trạng thái/hạn sử dụng, sắp xếp theo ngày tạo, hạn sử dụng hoặc tên. Các số tổng quan tính trên danh sách tài khoản API trả về, không thay đổi theo bộ lọc; không tính phòng đã kết thúc/hết hạn mà repository loại khỏi danh sách.

Có thể chọn các kết quả đang hiển thị để gia hạn 7 ngày hoặc kết thúc hàng loạt. Đổi bộ lọc sẽ bỏ chọn để tránh tác động app bị ẩn. Kết thúc yêu cầu xác nhận xóa câu trả lời; các request xử lý lần lượt và API kiểm tra quyền từng phòng. Khi thất bại một phần, dashboard báo số thành công/thất bại, giữ lại lựa chọn lỗi để thử lại. App đạt hạn tối đa không được chọn vào request gia hạn. Đây là thống kê vòng đời app, chưa phải analytics lượt truy cập/người tham gia.
