# API runtime lõi — memory milestone

API hỗ trợ bốn mẫu: `poll-drinks`, `quiz-general`, `wheel-participants`, `wheel-options`. Tạo từ mẫu không gọi OpenAI. Compose nâng cao chưa có backend tương ứng.

## Generate bằng OpenAI

`POST /api/generate` nhận `{prompt,lifetime?}`, prompt trim 1–500 ký tự, lifetime mặc định `1h`. Thành công trả HTTP 201 JSON `{ok:true,id,hostToken,generation:{provider,model,durationMs,attempts,repaired}}` và cookie host HttpOnly giống from-template. Không trả raw AppSpec hay đáp án quiz trong response tạo app. Đây là JSON một lần, không phải NDJSON; progress của UI là trạng thái chờ request, không stream token/stage provider.

Trước khi lưu, output phải khớp schema runnable: quiz, wheel hoặc compose một required choice input, multi=false, views bars. Output sai được thử repair một lần trong cùng deadline. Không có fallback mock/provider khác. Thiếu key → 503 ai_not_configured; refusal → 422 ai_refused; hết deadline → 504 ai_timeout; sai output sau repair → 502 ai_invalid_output; vượt quota/concurrency hoặc provider rate limit → 429. Không lưu app khi generation thất bại.

Giới hạn mặc định 30 yêu cầu generation/giờ, 2 request đồng thời cho một process. Một request có tối đa hai call OpenAI. Giới hạn không được hoàn lại khi provider báo lỗi; slot đồng thời luôn được giải phóng. Đây không phải quota theo tài khoản/IP hoặc giới hạn chi phí bền qua restart. Client generation cho phép tối đa 310 giây để bao phủ cấu hình deadline server tối đa 300 giây, các API runtime khác vẫn timeout 10 giây.

## Endpoint

| Method và đường dẫn | Đầu vào | Kết quả |
|---|---|---|
| `POST /api/apps/from-template` | `{templateId:"poll-drinks" hoặc "quiz-general" hoặc "wheel-participants" hoặc "wheel-options", locale:"vi" hoặc "en", lifetime:"1h" hoặc "24h" hoặc "7d"}` | 201: `{ok:true,id,hostToken}`; đặt cookie host HttpOnly riêng cho app |
| `GET /api/apps/:id/state` | Tùy chọn header `x-participant-token`; host dùng `x-host-view: 1` cùng cookie host hoặc `x-host-token` | Public AppSpec, runtime, trạng thái, version, kết quả được phép xem, số người và câu trả lời của chính token đó |
| `POST /api/apps/:id/responses` | `{blockId:"poll",itemId:"",participantToken,displayName:null,payload:{kind:"compose",values:{drink:"tea" hoặc "coffee"}}}` | 200: `{ok:true}`; upsert theo app/block/item/participant |
| `POST /api/apps/:id/lifecycle` | `{action:"close" hoặc "reopen" hoặc "end"}` và cookie host hoặc `x-host-token` | 200: `{ok:true}`; kết thúc xóa ngay các câu trả lời và không thể mở lại |

`POST /api/apps/:id/block-action` yêu cầu quyền host giống lifecycle, nhận `{blockId,action,args?}`. Quiz dùng action `open` hoặc `reveal`, args `{questionId}`. Wheel dùng action `spin` hoặc `reset`, không cần args. Trả `{ok:true}`. App đã đóng không nhận block action.

Response quiz: `{blockId:"quiz-1",itemId:"q1",participantToken,displayName:"Lan",payload:{kind:"quiz",optionId:"a"}}`. Chỉ nhận khi câu hỏi đó đang mở và chưa reveal; gửi lại cùng câu hỏi cập nhật đáp án hiện có.

Join wheel participant: `{blockId:"wheel",itemId:"",participantToken,displayName:"Lan",payload:{kind:"wheel",join:true}}`. Tên bắt buộc trong các app có requireName=true. Join lặp lại chỉ cập nhật bản ghi, không tăng số người. Wheel options không nhận join.

Các trường mặc định của request tạo mẫu: locale `vi`, lifetime `1h`. Body JSON tối đa 16 KiB; sai schema, trường thừa, option không có trong app hoặc itemId khác rỗng bị từ chối. Endpoint lifecycle chưa hỗ trợ extend/announce dù schema chung có mô tả các action này.

Trạng thái được trả với `Cache-Control: no-store`. Không trả AppRecord, hostTokenHash, full participantHash hoặc danh sách câu trả lời thô. Tên hiển thị trong leaderboard và wheel là dữ liệu công khai của hoạt động đó. Quiz trả đáp án null trước reveal cho cả spec host và participant. Host được xem option counts; participant chỉ nhận counts sau reveal. Điểm chỉ tính từ các câu đã reveal, leaderboard tối đa 10 người. Wheel trả danh sách hiện còn và lịch sử cùng một kết quả do server chọn.

State host yêu cầu cờ `x-host-view: 1` để phân biệt rõ audience. Cookie host đặt HttpOnly, SameSite=Lax, path giới hạn `/api/apps/:id`, thời hạn tương ứng app; Secure khi request dùng HTTPS. UI không lưu hostToken trong localStorage, query string hoặc link chia sẻ. Giá trị hostToken trả lúc tạo chỉ dành cho chủ app và công cụ tích hợp, không chia sẻ nó.

Participant dùng token ngẫu nhiên theo app lưu trong localStorage. Xóa dữ liệu trình duyệt hoặc dùng trình duyệt khác tạo danh tính mới; đây không phải cơ chế chống một người bỏ nhiều phiếu. Token được hash kèm app id trước khi lưu. Chỉ token khớp mới đọc được câu trả lời đã lưu của chính nó. Gửi lại thay đổi lựa chọn hiện có thay vì cộng thêm lượt.

Các mutation từ browser kiểm tra Origin theo HTTP Host để chặn request từ origin khác. API client không có Origin vẫn phải cung cấp host credential cho thao tác host. Không cấu hình CORS chia sẻ credential ra ngoài.

## Lỗi

Body lỗi có `{ok:false,code,message}`. Các HTTP status chính: 400 payload không hợp lệ, 403 sai quyền hoặc origin, 404 app/template không tồn tại, 409 app đã đóng, câu hỏi chưa mở/đã reveal hoặc wheel hết người/lựa chọn, 410 đã hết hạn/kết thúc/bị chặn, 429 vượt giới hạn bộ nhớ. Không trả thông báo lỗi thô của provider hoặc secret.

## Giới hạn triển khai

Memory repository hoạt động trong một tiến trình Node, được dùng chung giữa các route bundle và hot reload. Giới hạn 200 app đang giữ, tối đa 1.000 bản ghi/app; participant cũ vẫn đổi vote được khi đạt giới hạn. Ghi và đổi lifecycle không có await giữa kiểm tra và cập nhật. Snapshot app và responses được clone cùng lúc để kết quả và version nhất quán.

Hết hạn chặn đọc/ghi; dữ liệu hết hạn hơn 10 phút được dọn khi tạo app tiếp theo. Kết thúc xóa answers ngay. Restart server xóa toàn bộ app và quyền host tương ứng. Có Supabase adapter và Realtime cho lưu bền/nhiều process khi bật `APP_STORAGE=supabase`; xem `supabase.md`. Chưa rate limit theo IP. Không triển khai memory mode lên nhiều replica/serverless rồi kỳ vọng dùng chung dữ liệu.

Client đọc state ngay. Memory polling mỗi 1,5 giây; Supabase dùng Broadcast/WebSocket và chỉ polling dự phòng 10 giây khi mất kết nối hoặc đọc state lỗi. Mỗi request có timeout 10 giây, mất mạng hiển thị lỗi và thử lại, tạm khóa vote khi state chưa cập nhật. Xem `supabase.md`.

## Quy tắc quiz và wheel

Quiz host mở từng câu; câu hỏi khác hoặc câu đã reveal từ chối đáp án. Reveal chỉ công bố câu được chọn và tính điểm theo `points`, không thưởng tốc độ. Mở lại câu đã reveal tạm ẩn đáp án và điểm câu đó cho đến reveal tiếp; các câu trả lời cũ được giữ, người chơi có thể đổi đáp án khi mở lại. timeLimitSec hiện chỉ là thời lượng gợi ý, không tự đóng câu hỏi bằng timer.

Wheel chọn bằng `crypto.randomInt` ở server trong cùng đoạn mutation đồng bộ với dữ liệu participant. Client không gửi winner. `removeWinner=true` loại người đã trúng cho đến khi reset; join lại không xoá dấu đã trúng. Lịch sử hiển thị tối đa 50 lượt nhưng danh sách loại trừ được giữ riêng để không cho trúng lại khi cắt lịch sử. Reset xoá lịch sử và dấu loại trừ, giữ người đã tham gia. Kết thúc app xoá cả answers và runtime/spins.

Quiz question id bắt buộc duy nhất trong toàn app vì runtime mở/reveal dùng id toàn cục. Đây là kiểm tra chặt hơn schema cũ để tránh reveal nhầm giữa hai quiz block dùng trùng question id.

## Compose engine

Xem `compose-engine.md` cho contract đầy đủ. Template bổ sung: `compose-survey`, `compose-expenses`, `compose-steps`.

- Một bản ghi: `itemId=""`; nhiều bản ghi: `itemId` khớp `^e-[a-z0-9]{6,16}$`, tối đa 50 mỗi participant/block. Cùng id cập nhật bản ghi, `{kind:"compose",values:{},removed:true}` xóa riêng bản ghi của participant gửi.
- Steps: `itemId` là id input đang mở, values chỉ chứa input đó. Host gọi block-action `next`, `close`, `restart`. `restart` giữ answers. Deadline server cho phép thêm 2 giây truyền mạng; host vẫn phải chuyển/đóng bước.
- State trả bars/stat/cloud/table/leaderboard/summary đã tính ở server, không trả hash nhóm participant. View `after_step` chỉ xuất hiện sau khi nguồn đóng; view không có source đợi tất cả bước đóng. View `host` không xuất hiện trong state participant.

State bổ sung `sync`: `{mode:"memory"}` hoặc `{mode:"supabase",url,publicKey,channel}`. Chỉ chứa public key, không có service role key. Broadcast `state_changed` chỉ yêu cầu tải lại state, không chứa answers. Lỗi lưu trữ trả `503 storage_unavailable`; conflict quá mức trả `429 rate_limited`.
