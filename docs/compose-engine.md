# Compose engine

Trang chủ có ba mẫu chạy không cần AI: khảo sát nhiều trường, sổ chi tiêu và khảo sát từng bước. API tạo template dùng các id `compose-survey`, `compose-expenses`, `compose-steps`. Dữ liệu vẫn là memory đơn tiến trình.

## Form và bản ghi

Mỗi block có 1–8 input và 1–4 view. Input hỗ trợ text, number, choice đơn/nhiều lựa chọn, rating nguyên, slot theo capacity, date và datetime cục bộ. Server kiểm tra trường bắt buộc, id lạ, option, min/max, ngày hợp lệ và điều kiện showIf. Trường bị ẩn không được gửi giá trị; điều kiện phụ thuộc một trường đã ẩn cũng không được hiện.

`entries: one` cập nhật một bản ghi mỗi participant. `entries: many` dùng id bản ghi `e-` theo sau 6–16 ký tự chữ thường/số; thêm, sửa, xóa tối đa 50 bản ghi mỗi participant/block. Xóa gửi payload `{kind:"compose",values:{},removed:true}`. Danh tính lấy từ token đã hash, người khác không thể xóa bản ghi của bạn bằng cách dùng cùng itemId. Tổng hạn mức vẫn là 1000 response/app. Slot capacity được kiểm tra cùng thao tác ghi trong repository.

`flow: steps` chỉ kết hợp với `entries: one`. Host mở bằng `next`, đóng bằng `close`, đặt lại bằng `restart`. Mỗi bước nhận đúng input đang mở, không áp dụng showIf. Thời gian dựa vào timestamp server và timeLimitSec, cộng 2 giây truyền mạng. Hết giờ ngừng nhận answers nhưng không tự chuyển bước. Restart giữ answers, làm ẩn lại kết quả after_step; participant có thể gửi đè sau khi host mở lại.

## Thống kê và quyền xem

Bars đếm lựa chọn/slot/rating; stat hỗ trợ count/sum/avg/min/max; cloud đếm từ; table hiện các trường; leaderboard sắp số giảm dần; summary chạy query. Table/leaderboard tối đa 50 dòng mặc định. Giá trị thiếu không thành số 0 khi tính sum/avg/min/max. Tổng hợp số làm tròn hai chữ số; phép chia 0 hoặc số tràn trả null.

Visibility: everyone, after_submit (đã có answer trong block), after_step (nguồn đã đóng, hoặc mọi bước đã đóng nếu view không có source), after_close và host. Việc lọc thực hiện trước khi gửi state. Query nhóm theo participant dùng hash nội bộ nhưng chỉ gửi nhãn và id dòng theo thứ tự tới trình duyệt.

## Expression và query

Expression là JSON AST, không chạy JavaScript/eval. Các toán tử: field, lit, add/sub/mul/div, if, call; filter: and/or/not và eq/ne/gt/gte/lt/lte/has/empty/notEmpty. Hàm cho phép: coalesce, round, abs, min, max, isNumber, countOf, optionPrices. Giá optionPrices lấy từ spec server.

Query chạy theo thứ tự where → groupBy → measures → derived → sort → limit. Group theo option/rating/slot/date/datetime hoặc `$participant`, không group theo text/number. Measure hỗ trợ count/sum/avg/min/max với expression; count không expression đếm bản ghi. Derived đọc measure, derived trước đó, `$total.<measure>` và `$groups`. Lọc tên trường, cột trùng, arity hàm, giới hạn expression 6 tầng, JSON tối đa 300 node và 32 tầng trước khi parse đệ quy. Tối đa 6 measure, 6 derived và 200 nhóm kết quả.

Ví dụ tính tổng tiền theo người:

```json
{
  "where": null,
  "groupBy": "$participant",
  "measures": [{"key":"total","label":"Tổng chi","fn":"sum","expr":{"op":"field","key":"amount"}}],
  "derived": [],
  "sort": {"key":"total","dir":"desc"},
  "limit": 50
}
```

Chưa có roster, nhập schema/query bằng editor UI, export, ảnh, map, settle, chat hoặc preset expansion. OpenAI generation hiện vẫn sinh poll một lựa chọn, quiz và wheel; các chức năng Compose nâng cao chạy qua template/spec và chưa được đưa vào generation wire schema.
