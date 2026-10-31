# API bình chọn — memory milestone

API hiện hỗ trợ mẫu `poll-drinks`: một câu hỏi chọn đồ uống, một lựa chọn cho mỗi participant. Tạo từ mẫu không gọi OpenAI. Không coi các schema quiz/wheel hoặc compose nâng cao là nghiệp vụ đã có API.

## Endpoint

| Method và đường dẫn | Đầu vào | Kết quả |
|---|---|---|
| `POST /api/apps/from-template` | `{templateId:"poll-drinks", locale:"vi" hoặc "en", lifetime:"1h" hoặc "24h" hoặc "7d"}` | 201: `{ok:true,id,hostToken}`; đặt cookie host HttpOnly riêng cho app |
| `GET /api/apps/:id/state` | Tùy chọn header `x-participant-token`; host dùng `x-host-view: 1` cùng cookie host hoặc `x-host-token` | Public AppSpec, runtime, trạng thái, version, kết quả được phép xem, số người và câu trả lời của chính token đó |
| `POST /api/apps/:id/responses` | `{blockId:"poll",itemId:"",participantToken,displayName:null,payload:{kind:"compose",values:{drink:"tea" hoặc "coffee"}}}` | 200: `{ok:true}`; upsert theo app/block/item/participant |
| `POST /api/apps/:id/lifecycle` | `{action:"close" hoặc "reopen" hoặc "end"}` và cookie host hoặc `x-host-token` | 200: `{ok:true}`; kết thúc xóa ngay các câu trả lời và không thể mở lại |

Các trường mặc định của request tạo mẫu: locale `vi`, lifetime `1h`. Body JSON tối đa 16 KiB; sai schema, trường thừa, option không có trong app hoặc itemId khác rỗng bị từ chối. Endpoint lifecycle chưa hỗ trợ extend/announce dù schema chung có mô tả các action này.

Trạng thái được trả với `Cache-Control: no-store`. Không trả AppRecord, hostTokenHash, participantHash, displayName của người khác hoặc danh sách câu trả lời thô. Đáp án quiz tiếp tục được lọc bởi helper chung, nhưng chưa có API chơi quiz.

State host yêu cầu cờ `x-host-view: 1` để phân biệt rõ audience. Cookie host đặt HttpOnly, SameSite=Lax, path giới hạn `/api/apps/:id`, thời hạn tương ứng app; Secure khi request dùng HTTPS. UI không lưu hostToken trong localStorage, query string hoặc link chia sẻ. Giá trị hostToken trả lúc tạo chỉ dành cho chủ app và công cụ tích hợp, không chia sẻ nó.

Participant dùng token ngẫu nhiên theo app lưu trong localStorage. Xóa dữ liệu trình duyệt hoặc dùng trình duyệt khác tạo danh tính mới; đây không phải cơ chế chống một người bỏ nhiều phiếu. Token được hash kèm app id trước khi lưu. Chỉ token khớp mới đọc được câu trả lời đã lưu của chính nó. Gửi lại thay đổi lựa chọn hiện có thay vì cộng thêm lượt.

Các mutation từ browser kiểm tra Origin theo HTTP Host để chặn request từ origin khác. API client không có Origin vẫn phải cung cấp host credential cho thao tác host. Không cấu hình CORS chia sẻ credential ra ngoài.

## Lỗi

Body lỗi có `{ok:false,code,message}`. Các HTTP status chính: 400 payload không hợp lệ, 403 sai quyền hoặc origin, 404 app/template không tồn tại, 409 app đã đóng nhận vote, 410 đã hết hạn/kết thúc/bị chặn, 429 vượt giới hạn bộ nhớ. Không trả thông báo lỗi thô của provider hoặc secret.

## Giới hạn triển khai

Memory repository hoạt động trong một tiến trình Node, được dùng chung giữa các route bundle và hot reload. Giới hạn 200 app đang giữ, tối đa 1.000 bản ghi/app; participant cũ vẫn đổi vote được khi đạt giới hạn. Ghi và đổi lifecycle không có await giữa kiểm tra và cập nhật. Snapshot app và responses được clone cùng lúc để kết quả và version nhất quán.

Hết hạn chặn đọc/ghi; dữ liệu hết hạn hơn 10 phút được dọn khi tạo app tiếp theo. Kết thúc xóa answers ngay. Restart server xóa toàn bộ app và quyền host tương ứng. Chưa có lưu bền, đồng bộ nhiều process, rate limit theo IP hay production deployment với Supabase. Không triển khai memory mode lên nhiều replica/serverless rồi kỳ vọng dùng chung dữ liệu.

Client đọc state ngay và polling mỗi 1,5 giây sau mỗi lần đọc. Mỗi request có timeout 10 giây, mất mạng hiển thị lỗi và tiếp tục thử lại, tạm khóa vote khi trạng thái chưa cập nhật. Chưa có Supabase Realtime/WebSocket.
