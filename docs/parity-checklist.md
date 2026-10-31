# Checklist chức năng

Các nhóm chức năng runtime chính đã được port vào `src/engine/` và `src/engine-ui/`. Trang chủ giữ giao diện hiện tại. Không nhập lịch sử Git hoặc cấu hình bí mật từ dự án khác.

| Nhóm | Phạm vi đã có |
|---|---|
| Thư viện mẫu | `/templates`, mẫu Việt/Anh, preset choice/collect/open_text mở rộng thành compose |
| Compose | Form nhiều trường, điều kiện, nhiều dòng, steps, expression/query, thống kê, bảng, cloud, nhóm và danh sách chờ |
| Tương tác | Roster/check-in, chia đội, xếp hạng Borda, buzzer, bảng hỏi đáp/like, chat và xóa dòng của mình |
| Quiz/wheel | Mở/reveal, điểm, leaderboard; quay server, loại trừ người trúng và reset |
| Ảnh/bản đồ | Upload giới hạn dung lượng, bucket riêng tư, URL ký, duyệt ảnh; vị trí làm tròn và bản đồ OSM |
| Chia tiền | Tổng hợp khoản chi, settle, cấu hình người nhận, VietQR, xác nhận đã trả/đã nhận |
| Live/custom | Thời tiết/tỷ giá; HTML tương tác trong iframe sandbox, CSP chặn kết nối và quyền truy cập trang cha |
| Quản lý phòng | Đóng/mở, thông báo, gia hạn, CSV chống formula injection, kết thúc xóa dữ liệu trả lời |
| Remix | Dùng spec và kết quả hiện tại làm ngữ cảnh, tạo phòng con và chuyển participant |
| Tài khoản | Supabase magic link, session cookie, nhận quyền phòng, danh sách phòng và quyền host trên thiết bị khác |
| Bảo vệ | Kiểm tra cùng origin, host cookie HttpOnly, moderation OpenAI, phishing scan, báo cáo theo mạng, CSP và rate limit dùng chung |
| Lưu trữ | Snapshot JSONB, CAS atomic, Broadcast chỉ gửi phiên bản; rate limit và security log service-only |
| Retention | Migration cleanup snapshot hết hạn, rate limit và log; pg_cron tự cài job nếu extension đã bật |

Kiểm thử offline gồm domain/unit, route và Playwright. Kiểm thử project thật riêng bằng `npm run supabase:test`: ghi đồng thời, Realtime, quyền RPC, nhận quyền phòng, bucket riêng tư và xóa ảnh khi kết thúc. Không coi mock OpenAI hay mock đăng nhập là xác nhận dịch vụ thật.

Các lựa chọn triển khai: chỉ OpenAI, không fallback provider/mock; giữ adapter Supabase snapshot hiện có; giữ API và link `/a/` tương thích. Luồng đầy đủ dùng `/rooms/` và `/api/engine/`. Xem `full-runtime.md` về vận hành và các kiểm tra cần dịch vụ ngoài.

## Khoảng trống sau audit

Đối chiếu file/code phát hiện còn thiếu bộ eval AI, load/seed/warmup, một phần kiểm thử, HTTP headers và tối ưu fanout/cache. Proxy deploy hiện giới hạn body 16KB trong khi ảnh cho phép 600KB. Xem [source-port-audit.md](source-port-audit.md) để biết bằng chứng, mức ưu tiên và các khác biệt chủ động. Không xem checklist chức năng là xác nhận copy toàn bộ source 1:1.
