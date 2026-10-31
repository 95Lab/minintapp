# Kiến trúc component

Ngoài thư viện UI, `PollRoom`, `PollResults` và `CreatePollButton` đã nối luồng bình chọn mẫu vào API memory. Host và participant dùng polling; xem `api-contract.md`.

`src/components/` có đủ các đường dẫn của cấu trúc component đã đối chiếu, cộng `ui/component-notice.tsx` làm thông báo dùng chung. Đây là implementation mới với contract tối thiểu của dự án; có đủ file không có nghĩa đã hoàn thành mọi chức năng.

Mở `/preview` để xem thư viện và thử tương tác. Trang preview lưu câu trả lời trong React state, mất khi tải lại; không gọi OpenAI, không lưu database và không chia sẻ trạng thái giữa các thiết bị. QR sử dụng liên kết minh họa được ghi rõ trên trang.

## Các nhóm

| Nhóm | Nội dung |
|---|---|
| Root | Brand bar, trạng thái tích hợp, thông báo, tabs, renderer host/participant, payee slot |
| `create/` | Home screen, prompt/lifetime, tiến độ generation, gallery mẫu |
| `blocks/` | Registry, props dùng chung, compose input/form, quiz host/participant, wheel, biểu đồ, word cloud và các điểm mở rộng |
| `share/` | Link, sao chép và tạo QR bằng thư viện chạy local |
| `remix/` | Form yêu cầu và gợi ý theo loại block |
| `lifecycle/` | Countdown, trạng thái hết hạn/kết thúc/bị chặn |
| `account/` | Navigation, magic-link form và danh sách app |
| `ui/` | Thông báo tính năng chưa khả dụng |

## Cách nối dữ liệu

Renderer participant nhận `PublicAppSpec`, `AppRuntime`, `open`, `myAnswers` và callback `onSubmit(blockId, itemId, payload)`. Registry chọn UI theo discriminator `type`, không dùng cast `any`. Dùng `stripPrivateFields()` ở server trước khi truyền spec sang client. Không truyền `AppRecord`, token hash hay AppSpec có đáp án chưa reveal vào props client.

Renderer host nhận callback `onAction(blockId, action, args)`, `canControl` và trạng thái bận. UI không tự chọn người trúng hoặc tính điểm; server phải xác thực quyền và trả runtime chuẩn. Cờ `canControl` chỉ điều khiển giao diện, không thay thế quyền ở API.

Form compose hỗ trợ các input đang có trong schema, điều kiện `showIf`, trạng thái đang gửi, lỗi và câu trả lời đã lưu. Các form nhận callback bất đồng bộ, khóa submit khi chưa nối callback và không tự gọi endpoint chưa tồn tại. Prompt giữ giới hạn 500 ký tự, remix 300 ký tự. Component tài khoản không hoạt động mặc định; chỉ bật navigation khi các route xác thực đã có.

`ComposeViewRenderer` nhận kết quả đã được server lọc quyền; `null` là chưa công bố. Không chỉ che dữ liệu nhạy cảm bằng CSS. Các view board/chat/entries/orders/teams hiện là component hiển thị rows được truyền vào, chưa có nghiệp vụ tương ứng.

## Phần mở rộng

`compose-map-canvas`, `compose-map-view`, `compose-photo-field`, `compose-photo-upload`, `compose-place-field`, `compose-settle-view`, `compose-steps`, `custom-block`, `live-block` và `payee-form` hiện hiển thị thông báo chưa khả dụng. Chưa có upload, map service, payment, step runtime, iframe sandbox hoặc live fetching. Những component này chưa được đăng ký vào renderer vì schema chưa hỗ trợ.

Không dùng `dangerouslySetInnerHTML`, thực thi code tùy biến hay tải ảnh/bản đồ từ nguồn ngoài trong các component này. Mở rộng schema, API, quyền và test trước khi bật các điểm mở rộng.

## Kiểm tra

`npm run check` kiểm tra type, unit test và production build. `npm run test:e2e` sau build kiểm tra preview: gửi câu trả lời local, tabs bằng bàn phím, khôi phục đáp án đã gửi khi đổi tab, QR, nút host bị khóa, form chưa nối API và viewport mobile.
