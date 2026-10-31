# Supabase và Realtime

## Bật trên project

1. Mở SQL Editor của project Supabase và chạy toàn bộ `supabase/migrations/202610310001_supabase_storage.sql` và `supabase/migrations/202610310002_full_runtime.sql` theo thứ tự. Migration tạo bảng mới và ba RPC, không nhập dữ liệu từ dự án khác. Nếu quản lý bằng Supabase CLI, link đúng project và dùng `supabase db push` thay cho SQL Editor; không áp dụng bằng cả hai cách.
2. Điền `.env.local` (không commit file này):

```dotenv
APP_STORAGE=supabase
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_SERVICE_ROLE_OR_SECRET_KEY
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
```

Server key có thể là legacy service_role JWT hoặc `sb_secret_…`; public key là legacy anon JWT hoặc `sb_publishable_…`. Hai URL phải trỏ cùng project. Các giá trị public được trả trong state API khi chạy Supabase, nên Docker có thể cấu hình chúng lúc chạy thay vì build lại image. Không đặt server key vào biến public.

3. Project cần bật Realtime và cho phép public channels. Không thêm bảng `minint_app_snapshots` vào publication: answers, spec và credentials không được đưa trực tiếp vào Postgres Changes. Migration gửi thông báo bằng `realtime.send` sau mỗi lần cập nhật. Không cần policy đọc `realtime.messages` cho anonymous/public broadcast.
4. Chạy `npm run env:check`, `npm run supabase:check`, rồi khởi động lại app. `supabase:check` kiểm tra migration, quyền service role, chặn anon và subscribe/broadcast trên một topic kiểm tra ngẫu nhiên; không sửa dữ liệu phòng.
5. Chạy `npm run supabase:test` để kiểm tra thật chuỗi ghi đồng thời → lưu bền qua nhiều repository → broadcast từ PostgreSQL → state đã lọc quyền. Test tạo một phòng riêng rồi kết thúc/xóa answers của riêng phòng đó, không sửa phòng đang dùng.
6. Tạo phòng mới và mở bằng hai trình duyệt, gửi/đổi câu trả lời, đóng/mở bước. Restart Node rồi mở lại link để kiểm tra dữ liệu và quyền host vẫn còn. Phòng đã tạo bằng memory không tự chuyển vào database.

VPS Docker: điền cùng biến vào file `deploy/.env.app` trên máy chạy app rồi recreate container. `.env.local` trên laptop không cấu hình container VPS. Build và kiểm thử offline không cần service key; không đưa secret vào build args hoặc image.

## Cách lưu và ghi đồng thời

Mỗi phòng là một aggregate JSONB trong bảng có RLS. App, runtime, answers và stateVersion được đọc từ cùng snapshot. Domain validation dùng chung với memory adapter. Ghi qua RPC `minint_commit` khóa hàng và so phiên bản; nếu có writer khác đi trước, server đọc snapshot mới, kiểm tra lại quyền, slot capacity, giới hạn bản ghi, bước đang mở và trạng thái nhận câu trả lời trước khi thử lại. Host action wheel cũng chỉ có một kết quả đã commit.

Thời gian validate mutation lấy từ PostgreSQL; RPC kiểm tra lại hết hạn và deadline bước ngay khi commit. Kết thúc app xóa answers và runtime trong cùng giao dịch. Giới hạn 1000 response/phòng, 50 bản ghi/người/block ; runtime đầy đủ cho phép gia hạn tối đa 30 ngày, hoặc 90 ngày với tài khoản sở hữu. Storage không dùng giới hạn 200 phòng của memory; cần theo dõi dung lượng và thiết lập retention phù hợp.

Cập nhật một phòng được tuần tự hóa; snapshot có thể lớn khi gần 1000 answers. Đây là cách lưu phù hợp phòng nhỏ/vừa, chưa phải thiết kế phân mảnh cho phòng tải lớn. Conflict thử lại có jitter, tối đa 16 lượt trong ngân sách request 8 giây; quá tải trả 429. Mất kết nối database trả 503, không chuyển ngầm về memory. Khi timeout không rõ commit đã thành công hay chưa, client cần đọc state trước khi thử lại host action; không tự retry một wheel spin.

## Đồng bộ và quyền dữ liệu

Server trả topic ngẫu nhiên 256 bit cho người đã mở được state của phòng. Topic public chỉ phát `{version}`. Browser dùng public key subscribe topic; khi có thông báo sẽ gọi state API với cookie host hoặc participant token của mình. Không tin version/payload do client broadcast và không áp dụng trực tiếp chúng vào UI. Vì vậy đáp án quiz chưa reveal, view host-only, token hash và câu trả lời của người khác vẫn được lọc tại server. Public topic không phải quyền host; người biết topic chỉ có thể gây thêm yêu cầu refresh, không ghi dữ liệu phòng.

Kết nối Realtime khỏe không có polling định kỳ. Tải lại state khi subscribe/reconnect, trở lại tab hoặc online, sau mutation của chính mình và khi hết hạn. Thông báo dồn được gộp; có refresh bổ sung nếu thông báo đến lúc đang tải state. Mất WebSocket hoặc đọc state lỗi dùng polling dự phòng mỗi 10 giây, tự dừng khi kết nối ổn định. SDK quản lý heartbeat và reconnect; hook gỡ channel, listener và timer khi đổi phòng hoặc unmount.

`APP_STORAGE=memory` dành cho offline/demo: dữ liệu mất khi restart, polling 1,5 giây và chỉ dùng một tiến trình. Supabase mode dùng chung dữ liệu giữa nhiều Node instance. Runtime đầy đủ dùng distributed rate limit, Supabase Auth và retention RPC/cron qua migration thứ hai. Memory không tự di chuyển dữ liệu sang Supabase. Xem `full-runtime.md` về callback đăng nhập và dọn ảnh Storage.

## Kiểm thử

`npm run check` thực thi SQL migration trên PostgreSQL nhúng PGlite, kiểm tra quyền anon/authenticated, persistence qua các repository instance, conflict, lifecycle và giới hạn slot. Chỉ hàm chuyển tiếp Realtime được thay bằng nơi ghi thông báo kiểm thử; đây chưa phải project Supabase thật.

`npm run test:e2e` giữ các luồng thật qua API memory và thêm kiểm thử SDK Supabase trong browser với WebSocket được giả lập để xác minh refresh giữa thiết bị và không polling khi khỏe. `npm run supabase:check` là kiểm tra kết nối thật riêng, cần cấu hình project và migration; `npm run supabase:test` kiểm tra chuỗi PostgreSQL → Realtime → API thật trên một phòng riêng. Kiểm thử app trên hai thiết bị xác nhận thêm toàn bộ giao diện thực tế.

Tham khảo chính thức: [Broadcast từ database](https://supabase.com/docs/guides/realtime/broadcast), [API keys](https://supabase.com/docs/guides/getting-started/api-keys).
