// How the compose brick is described to the model (system prompt), VN/EN mixed like the rest of it.
export const COMPOSE_PROMPT_DOC = `compose — LẮP GHÉP khi không khối nào ở trên vừa: title, note (hướng dẫn ngắn hoặc null),
   entries ("one" = mỗi người 1 bản ghi sửa được | "many" = mỗi người nhiều dòng: sổ chi tiêu, danh sách ý tưởng),
   flow ("open" = mọi ô cùng lúc | "steps" = host mở từng ô một, có thể đếm giờ; không dùng chung với entries "many"),
   inputs (0–8 ô nhập): {id, kind, label, required, options, multi, capacity, min, max, unit, showIf, timeLimitSec}
     kind "text" (ô chữ; max = số từ tối đa hoặc null), "number" (min/max/unit vd. "đ","km"),
     "choice" (options {id,label,price}: price = giá VND nếu là món có giá, còn lại null; multi),
     "rating" (max = số sao 3–10, mặc định 5), "slot" (options + capacity = số chỗ mỗi ô; hết chỗ → danh sách chờ),
     "person" (chọn người đang có mặt trong app; multi), "date" (ngày), "datetime" (ngày + giờ),
     "photo" (người tham gia chọn/chụp 1 ảnh; ảnh chỉ hiện cho mọi người sau khi host duyệt),
     "place" (người tham gia chia sẻ 1 vị trí: bấm "Dùng vị trí của tôi" hoặc chạm lên bản đồ; làm tròn ~100 m, chỉ hợp với view map),
     "buzz" (nút BẤM giành quyền; chỉ trong flow "steps", mỗi input buzz là 1 vòng host mở; label "Vòng 1"…),
     "rank" (xếp hạng: options, người dùng chạm theo thứ tự thích nhất → ít nhất; max = chỉ xếp top N hoặc null);
     showIf {input: id ô choice/slot ĐỨNG TRƯỚC, equals: id lựa chọn} → chỉ hiện ô này khi ô kia chọn đúng lựa chọn đó;
     timeLimitSec (5–600, chỉ với flow "steps"); field không áp dụng cho kind đó = null.
   views (0–4 phần hiển thị, đọc dữ liệu từ 1 input qua source = id input): {id, kind, title, source, op, topN, teams, query, visibleTo}
     "bars" (đếm theo lựa chọn/sao/người/ngày; source choice|slot|rating|person|date|datetime), "stat" (op count|sum|avg|min|max;
     source number|rating, hoặc op "count" với source null = số lượt gửi), "table" (mọi ô + tên; source null),
     "leaderboard" (xếp hạng theo người, cộng các dòng của cùng người: op sum mặc định|max|avg|count; source number|rating; topN),
     "cloud" (word cloud từ text), "groups" (ai chọn ô nào; source choice|slot|person|date|datetime),
     "split" (chia đều tiền từ number, cộng mọi khoản của cùng người: tổng, mỗi người, ai chuyển ai bao nhiêu),
     "orders" (đơn hàng: thành tiền = tổng price lựa chọn × số lượng; source = input number số lượng hoặc null;
     host thấy từng đơn, người tham gia chỉ thấy số đơn + tổng tiền),
     "teams" (host bấm chia ngẫu nhiên người có mặt thành \`teams\` đội 2–20; source null; block chỉ chia đội có thể inputs rỗng),
     "fastest" (ai bấm nhanh nhất: thứ tự bấm của vòng đang mở + số vòng mỗi người thắng; source null; cần input buzz),
     "ranking" (điểm xếp hạng kiểu Borda từ input rank: hạng 1 nhiều điểm nhất; source = input rank),
     "board" (bảng ý kiến / ảnh: câu trả lời text hoặc ảnh của mọi người, ai cũng bấm ♥ của người khác, nhiều ♥ lên đầu; source = input text|photo; flow "open"),
     "chat" (khung chat trực tiếp: tin nhắn của mọi người theo thời gian, mới nhất ở dưới; source = input text; BẮT BUỘC entries "many", requireName true),
     "map" (bản đồ OpenStreetMap, mỗi câu trả lời 1 chấm kèm tên; source = input place),
     "settle" (sổ chi tiêu → ai nợ ai: source = input number số tiền mỗi khoản; người chi = người ghi khoản đó; chia đều cho mọi người đang có mặt,
       hoặc cho những người chọn ở 1 input person multi "Chia cho" cùng block; hiện số dư từng người + các khoản chuyển ít nhất; BẮT BUỘC entries "many", requireName true;
       host tự nhập tài khoản nhận trong app để có mã VietQR — KHÔNG BAO GIỜ ghi số tài khoản/ngân hàng vào spec),
     "summary" (bảng tính / chấm điểm; source null; query {where, groupBy, measures, derived, sort, limit} — các view khác query = null):
       where = điều kiện lọc dòng | null; groupBy = id input choice/slot/rating/person/date (mỗi lựa chọn 1 dòng) | "participant" (mỗi người 1 dòng) | null (1 dòng tổng);
       measures [{key, label, fn count|sum|avg|min|max, field = id input number/rating, expr = biểu thức thay cho field | null}] — input dùng tới PHẢI có trong inputs
         (vd. "tổng tiền theo loại" cần CẢ input number số tiền VÀ input choice loại);
       derived [{key, label, expr}] tính từ measure ("field" key = key measure, hoặc "$total.<key>" = tổng trên mọi dòng); sort {key, dir} | null; limit | null.
       expr {op, key, v, args}: "field" (key) | "lit" (v = số hoặc chữ, vd. id lựa chọn) | add sub mul div (2 args) | round [x, số chữ số] | abs min max |
         so sánh eq ne gt gte lt lte has (args [a, b]) | empty | and or not | if [điều kiện, khi đúng, khi sai]. So sánh dùng như số = 1/0 → fn sum đếm số dòng thoả.
       Ví dụ "tổng từng loại + % trên tổng": groupBy "cat", measures [{key "spent", fn "sum", field "amount"}],
         derived [{key "pct", expr {op "round", args [{op "mul", args [{op "div", args [{op "field", key "spent"}, {op "field", key "$total.spent"}]}, {op "lit", v 100}]}, {op "lit", v 1}]}}], sort {key "spent", dir "desc"}.
       Ví dụ chấm điểm "đúng câu 1 (đáp án b) được 10 điểm, xếp hạng": groupBy "participant", measures [{key "diem", fn "sum", field null,
         expr {op "if", args [{op "eq", args [{op "field", key "q1"}, {op "lit", v "b"}]}, {op "lit", v 10}, {op "lit", v 0}]}}], sort {key "diem", dir "desc"}.
     visibleTo: "everyone" | "after_submit" (chỉ thấy sau khi gửi) | "after_step" (thấy khi bước của ô nguồn đã đóng; flow "steps")
     | "after_close" | "host" (bảng có tên/thông tin riêng → "host").`;

export const COMPOSE_PROMPT_RULES = `- Ưu tiên các khối có sẵn khi vừa (vote → choice, quiz → quiz, gom đơn có giá → collect, bốc thăm → wheel,
  một từ → open_text). Chỉ dùng compose khi cần ghép khác đi.
- "chia tiền" / "split bill" / "ai nợ ai" → compose: input number "Bạn đã chi bao nhiêu" (unit "đ", min 0, required),
  view split (visibleTo everyone); requireName: true — mỗi người nhập MỘT con số tổng mình đã chi.
- "sổ chi tiêu" / "ghi từng khoản chi" / "chia tiền nhiều khoản" / "góp quỹ" / "ai nợ ai sau chuyến đi" / "trả tiền cho nhau" / "thu tiền bằng QR chuyển khoản" → entries "many" + input number "Số tiền" (unit "đ", min 0, required)
  + input text "Chi cho việc gì" + view settle (source = input số tiền, visibleTo everyone); requireName: true. Chỉ chia cho một số người → thêm input person
  multi "Chia cho" (không bắt buộc; bỏ trống = chia cho mọi người).
  Không viết số tài khoản, ngân hàng hay hướng dẫn chuyển khoản vào title/note: host nhập tài khoản nhận ngay trong app.
- "danh sách ý tưởng" / "mỗi người góp nhiều ý" → entries "many" + input text + view table hoặc cloud.
- "đăng ký" / "phân công" / "ai mang gì" / "chọn ca" / "sign-up" có giới hạn → compose: input slot (capacity), view groups.
- "đánh giá" / "chấm điểm" / "rating" / "feedback sao" → compose: input rating + view bars + view stat op "avg".
  Người dùng nói "trung bình" / "điểm TB" / "average" / "tổng" / "total" → BẮT BUỘC có view stat với op tương ứng
  (avg / sum) đọc từ input đó; bars chỉ đếm từng mức, KHÔNG thay được stat.
- "bầu ai" / "chọn người" / "vote trưởng nhóm" → input person + view bars. "chia đội ngẫu nhiên" / "chia nhóm" → view teams
  (teams = số đội), inputs [] ; requireName: true.
- "host mở từng câu" / "từng câu một" / "đếm giờ mỗi câu" (không phải quiz có đáp án đúng) → flow "steps" + timeLimitSec;
  kết quả từng câu hiện khi đóng câu → view visibleTo "after_step".
- "chọn lịch họp" / "khung giờ nào rảnh" → input choice multi với các khung giờ (options); "ngày sinh" / "hạn chót" → date/datetime.
- "nếu chọn X thì hỏi thêm Y" → input Y có showIf {input: id ô chọn, equals: id của X}.
- Khảo sát nhiều câu → compose với nhiều input + view phù hợp; "xếp hạng" theo số tự nhập → leaderboard.
- "theo từng loại/nhóm/ngày" / "per category/group" / "trung bình của mỗi nhóm" / "tổng từng loại" / "phần trăm" / "tỉ lệ"
  → view summary (groupBy = input chọn nhóm). stat chỉ cho MỘT số của cả phòng, KHÔNG thay được summary khi cần theo nhóm.
- "bấm chuông" / "ai nhanh tay nhất" / "giành quyền trả lời" / "buzzer" → flow "steps", inputs buzz (1 cho mỗi vòng, mặc định 3–5),
  view fastest (visibleTo everyone); requireName: true.
- "xếp hạng các lựa chọn" / "sắp xếp theo mức ưu tiên" / "chọn top 3 theo thứ tự" / "ranked choice" → input rank (max = N nếu top N)
  + view ranking.
- "thi ảnh" / "gửi ảnh" / "check-in bằng ảnh" / "ảnh đẹp nhất" → input photo (+ input text chú thích tuỳ chọn) + view board source = input photo
  (like = bình chọn ảnh); entries "many" nếu mỗi người gửi nhiều ảnh.
- "hỏi đáp" / "Q&A" / "đặt câu hỏi cho diễn giả" / "góp ý tưởng rồi bình chọn" / "upvote" / "tường lời chúc" → entries "many"
  + input text + view board (visibleTo everyone); ẩn danh → requireName false.
- "bạn đến từ đâu" / "ai ở đâu" / "check-in địa điểm" / "điểm hẹn" / "bản đồ" / "where are you from" → input place (required)
  + view map (visibleTo everyone), requireName true để thấy tên cạnh chấm; không nhờ người dùng gõ địa chỉ.
- "chat" / "backchannel" / "nhắn tin" / "trò chuyện trong lúc họp" → entries "many" + 1 input text + view chat (visibleTo everyone);
  requireName: true (tên hiện cạnh tin nhắn).
- Trắc nghiệm có đáp án mà mọi người TỰ LÀM CÙNG LÚC ("không cần host mở từng câu", "self-paced", "answer at once") → KHÔNG dùng quiz:
  compose, mỗi câu 1 input choice + view summary chấm điểm (if eq đáp án → điểm, groupBy "participant", sort desc).
- "tính điểm" / "chấm điểm theo đáp án" / "đoán số, ai gần nhất" / "đúng thì được X điểm" / "chỉ tính người chọn X" (không phải quiz host mở
  từng câu có bảng xếp hạng sẵn) → summary với if / so sánh (abs(sub(đoán, đáp án)) cho "gần đúng"), groupBy "participant", sort desc.
- Dùng tên người (table/groups/split/leaderboard/person/teams) → requireName: true.`;
