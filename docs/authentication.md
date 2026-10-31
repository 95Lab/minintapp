# Đăng nhập và đăng ký Supabase

Supabase chỉ xác minh danh tính email. PostgreSQL vẫn lưu metadata và dữ liệu app; không cần chuyển `APP_STORAGE` sang `supabase` để bật tài khoản.

## Biến môi trường

Nguồn duy nhất là `/root/.config/ai-secrets/api.env` trên server. Compose truyền `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` vào Control Plane. Các URL phải cùng project; public key phải là anon/publishable key. Không inject service-role key hoặc API key OpenAI/Cloudflare vào sandbox. Control Plane dùng `IP_HASH_SALT` hiện có để ký session; bật Auth không đổi signing key.

## Cấu hình Supabase Dashboard

Trong Authentication → URL Configuration, đặt Site URL thành `https://minintapp.io.vn` và thêm Redirect URL `https://minintapp.io.vn/auth/callback**` (gồm query PKCE). Giữ nguyên redirect URL của sản phẩm khác nếu project dùng chung. Email provider và đăng ký mới phải được bật. Cần custom SMTP để gửi cho người ngoài tổ chức nếu dịch vụ email mặc định của Supabase giới hạn người nhận.

## Luồng người dùng

1. Mở `/login`, nhập email. Email mới tự tạo tài khoản, email cũ đăng nhập; không cần mật khẩu.
2. Server yêu cầu magic link qua Supabase và đặt cookie PKCE HttpOnly/Secure trong trình duyệt này. Mở email bằng cùng trình duyệt. Yêu cầu gửi lại thay thế verifier cũ.
3. Callback chỉ nhận authorization code, xóa query/fragment khỏi thanh địa chỉ rồi đổi code trên server bằng verifier đã ký. Không chấp nhận access token tùy ý. Access/refresh token không lưu ở localStorage hoặc trả cho browser.
4. Server đặt session cookie `__Host-minint_session` trên HTTPS, tối đa 30 ngày. Sign out xóa session local; không tuyên bố thu hồi mọi phiên Supabase trên thiết bị khác.
5. App tạo sau đăng nhập gắn với user ID. App RUNNING ẩn danh thuộc tenant cookie hoặc có host token hợp lệ được claim về tài khoản; app của người khác không bị chuyển quyền. App chưa chạy có thể claim sau khi RUNNING.

Có rate limit cho gửi link/đổi code. Lỗi gửi email trả lỗi chung, không trả lỗi provider hoặc thông tin key. Một yêu cầu được Supabase chấp nhận chưa chứng minh email đã tới inbox; cần người nhận xác nhận.

## Kiểm thử

Unit test kiểm tra PKCE cookie, expiry/tampering, session/logout, cấu hình auth-only và SDK challenge/verifier với HTTP giả. E2E kiểm tra form, callback và claim. Kiểm tra live dùng project thật, không đưa token vào output; tài khoản test tạm được xóa. Việc gửi email thật chỉ thực hiện tới địa chỉ được chủ hệ thống chỉ định.

Tham khảo: [Supabase PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow), [passwordless email](https://supabase.com/docs/guides/auth/auth-email-passwordless).

Nút **Đăng xuất** hiện trực tiếp trên header khi đã đăng nhập, gồm cả mobile. Nút có trạng thái đang xử lý, cho phép thử lại khi lỗi; server xóa cả session và cookie PKCE đang chờ. Đăng xuất không xóa dữ liệu ứng dụng.
