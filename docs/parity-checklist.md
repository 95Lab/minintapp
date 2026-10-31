# Checklist tương đương chức năng

Theo dõi hành vi đã có và phần còn thiếu, không quy đổi số file thành phần trăm hoàn thành. Bản hiện tại chạy một Node process, dữ liệu memory, không có Supabase thật. Các mục dưới là trạng thái implementation mới; chưa phải chứng nhận tương đương toàn bộ sản phẩm.

| Nhóm | Trạng thái hiện tại | Bằng chứng / giới hạn |
|---|---|---|
| Poll một lựa chọn | Đã có luồng tạo → share → gửi/đổi vote → host xem kết quả | Unit repository/API, E2E poll-loop với hai participant độc lập |
| Quiz | Đã có open/reveal, chặn câu chưa mở, upsert đáp án, tính điểm và leaderboard | Unit core-runtime, E2E core-runtime; chưa tự đóng theo timeLimitSec |
| Wheel participant | Đã có tên, join, chọn server, đồng bộ winner, loại trừ và reset | Unit crypto candidate pool/no-repeat, E2E hai trình duyệt |
| Wheel options | Đã có danh sách cố định và loại lựa chọn đã trúng | Unit kiểm tra hết lựa chọn, từ chối join |
| Quyền host | Kiểm tra cookie/token tại API lifecycle và block-action, cách ly app | Unit API và E2E; chưa có account/session đăng nhập |
| Lifecycle | Đóng, mở lại, hết hạn, kết thúc xoá answers và runtime | Unit memory; chưa gia hạn, export, cleanup nền |
| Schema/UI chung | Có compose/quiz/wheel cơ bản, component và preview | Chưa có preset expansion và schema compose đầy đủ |
| OpenAI | Đã nối trang chủ → generate → validate/repair → lưu app → host | SDK/route/UI mock tests; chưa gọi OpenAI thật; chỉ sinh block runnable |
| Đồng bộ | Polling 1,5 giây, khôi phục câu trả lời qua token local | Chưa broadcast/Supabase Realtime |
| Lưu trữ | Memory đơn tiến trình và snapshot atomic | Restart mất dữ liệu, chưa migration/Supabase |
| Compose engine | Form nhiều trường, thống kê, nhiều dòng, steps, expression/query | Unit compose-engine và E2E compose-engine; roster và các view chuyên biệt chưa có |
| Mở rộng | Có vị trí component, chưa có backend | Upload, map, chat, payments, live/custom chưa khả dụng |
| Remix | Form UI và contract ban đầu | Chưa pipeline theo dữ liệu, route hoặc chuyển participant |
| Bảo mật mở rộng | Token hash, giới hạn payload và giới hạn memory | Chưa rate limit theo IP, moderation, phishing scan, CSP/sandbox đầy đủ |

Các khác biệt chủ động trong core runtime: question id phải duy nhất toàn app; dấu loại trừ người trúng giữ riêng, không mất khi cắt lịch sử wheel còn 50 lượt. Tên và điểm được hiển thị dưới dạng text React, không render HTML từ dữ liệu người dùng.
