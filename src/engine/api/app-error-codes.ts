// Error codes the API returns (`{ ok: false, code, params }`), with their text in every UI language.
// The server never picks wording for a person: the client shows `errorText(code, locale, params)` in
// the app's language. Unknown codes (an older client, a proxy error page) fall back to a generic line
// instead of showing raw text. Placeholders like {max} are filled from `params`.
import type { Locale } from "@/engine/app-spec/app-spec-schema";

const MESSAGES = {
runtime_unavailable:{vi:"Tính năng địa chỉ riêng chỉ khả dụng trên nền tảng đang hoạt động.",en:"Custom addresses require an available platform runtime."},
subdomain_invalid:{vi:"Tên subdomain không hợp lệ hoặc được dành riêng.",en:"Invalid or reserved subdomain name."},subdomain_taken:{vi:"Tên subdomain đã được sử dụng. Hãy chọn tên khác.",en:"This subdomain is already in use. Choose another name."},
  // request / access
  bad_request: { vi: "Yêu cầu không hợp lệ.", en: "Invalid request." },
  not_found: { vi: "Không tìm thấy.", en: "Not found." },
  host_only: { vi: "Chỉ host thực hiện được.", en: "Only the host can do this." },
  network: { vi: "Mất kết nối. Thử lại nhé.", en: "Connection lost. Please try again." },
  unknown: { vi: "Có lỗi xảy ra.", en: "Something went wrong." },
  // rate limits
  owner_app_limit: { vi: "Bạn đã có 50 ứng dụng đang hoạt động. Mở Ứng dụng của tôi, chọn “Kết thúc và xóa” app cũ rồi chờ dọn dẹp hoàn tất. Tạm dừng không giải phóng chỗ.", en: "You already have 50 active apps. Open My apps and choose “End and delete”, then wait for cleanup to finish. Pausing does not free a slot." },
  app_capacity_full: { vi: "Hệ thống đã hết chỗ chạy ứng dụng. Vui lòng thử lại khi có ứng dụng được kết thúc và dọn dẹp.", en: "The system has no free app capacity. Try again after an app ends and cleanup finishes." },
  creation_hourly_limit: { vi: "Hệ thống đã đạt giới hạn tạo ứng dụng trong một giờ. Vui lòng thử lại sau.", en: "The system has reached its hourly app creation limit. Please try again later." },
  rate_limited: { vi: "Chậm lại một chút nhé.", en: "Slow down a little." },
  create_rate_limited: { vi: "Bạn tạo app hơi nhanh, thử lại sau {minutes} phút.", en: "You're creating apps a bit fast; try again in {minutes} min." },
  remix_rate_limited: { vi: "Bạn remix hơi nhanh, thử lại sau ít phút.", en: "You're remixing a bit fast; try again in a few minutes." },
  already_reported: { vi: "Bạn đã báo cáo rồi.", en: "You already reported this app." },
  // app lifecycle
  app_closed: { vi: "App đã ngừng nhận câu trả lời.", en: "This app no longer accepts answers." },
  app_moved: { vi: "App này đã chuyển sang app mới.", en: "This app has moved to a new one." },
  app_ended_or_moved: { vi: "App đã kết thúc hoặc đã được remix.", en: "This app has ended or was remixed." },
  announce_refused: { vi: "Thông báo này không gửi được.", en: "This announcement can't be sent." },
  announce_rate_limited: { vi: "Bạn gửi thông báo hơi nhanh, thử lại sau ít phút.", en: "You're announcing a bit fast; try again in a minute." },
  payee_invalid: {
    vi: "Kiểm tra lại: chọn ngân hàng, số tài khoản 6–19 chữ số, tên chủ tài khoản viết hoa không dấu.",
    en: "Check again: pick a bank, an account number of 6–19 digits and the account holder name (A–Z, no accents).",
  },
  payee_needs_settle_view: { vi: "App này không có phần chia tiền nên không cần tài khoản nhận.", en: "This app has no settle-up view, so it needs no payee account." },
  app_cannot_reopen: { vi: "App này không mở lại được.", en: "This app can't be reopened." },
  lifetime_max: { vi: "App chỉ sống tối đa {days} ngày kể từ lúc tạo.", en: "An app can live at most {days} days after it was created." },
  move_target_not_host: { vi: "Chỉ chuyển sang app bạn cũng là host.", en: "You can only move to an app you also host." },
  // host accounts
  accounts_disabled: { vi: "Tính năng tài khoản chưa bật ở máy chủ này.", en: "Accounts are not enabled on this server." },
  email_invalid: { vi: "Email chưa đúng, kiểm tra lại nhé.", en: "That email doesn't look right." },
  auth_rate_limited: { vi: "Bạn yêu cầu link đăng nhập hơi nhiều, thử lại sau {minutes} phút.", en: "Too many sign-in requests; try again in {minutes} min." },
  auth_delivery_failed: { vi: "Chưa gửi được email đăng nhập. Vui lòng thử lại sau.", en: "Could not send the sign-in email. Please try again later." },
  auth_link_invalid: { vi: "Link đăng nhập đã hết hạn hoặc không hợp lệ. Hãy yêu cầu link mới.", en: "This sign-in link expired or is invalid. Request a new one." },
  sign_in_required: { vi: "Hãy đăng nhập trước.", en: "Please sign in first." },
  // answers
  unknown_block: { vi: "Không tìm thấy câu hỏi.", en: "Question not found." },
  bad_payload: { vi: "Câu trả lời không hợp lệ.", en: "Invalid answer." },
  question_closed: { vi: "Câu hỏi này đã đóng.", en: "This question is closed." },
  name_required: { vi: "Hãy nhập tên hiển thị.", en: "Please enter a display name." },
  too_long: { vi: "Nội dung quá dài.", en: "Too long." },
  entries_limit: { vi: "Bạn đã đạt tối đa {max} dòng.", en: "You've reached the maximum of {max} entries." },
  reporter_missing: { vi: "Thiếu định danh người báo cáo.", en: "Missing reporter id." },
  // host actions
  bad_action: { vi: "Hành động không hợp lệ.", en: "Invalid action." },
  no_more_steps: { vi: "Đã hết bước.", en: "No more steps." },
  no_open_step: { vi: "Chưa có bước nào đang mở.", en: "No step is open." },
  no_teams_view: { vi: "Không có phần chia đội.", en: "This block has no team draw." },
  need_two_people: { vi: "Cần ít nhất 2 người tham gia.", en: "At least 2 participants are needed." },
  question_not_found: { vi: "Câu hỏi không tồn tại.", en: "Question not found." },
  wheel_no_entrants: { vi: "Chưa có ai tham gia bốc thăm.", en: "Nobody has joined the draw yet." },
  wheel_empty: { vi: "Hết ô để quay.", en: "No entries left to spin." },
  // generation / remix / templates
  prompt_invalid: { vi: "Hãy mô tả app bạn cần (tối đa 500 ký tự).", en: "Describe the app you need (up to 500 characters)." },
  generate_refused: { vi: "Không tạo app này.", en: "This app can't be created." },
  generate_unsupported: { vi: "Chưa làm được app kiểu này.", en: "This kind of app isn't supported yet." },
  generate_failed: { vi: "Có lỗi khi tạo app. Thử lại nhé.", en: "Creating the app failed. Please try again." },
  remix_instruction_invalid: { vi: "Hãy mô tả bạn muốn đổi gì (tối đa 300 ký tự).", en: "Describe what to change (up to 300 characters)." },
  remix_already: { vi: "App này đã được remix.", en: "This app was already remixed." },
  remix_busy: { vi: "Đang remix, chờ một chút.", en: "A remix is in progress, hold on." },
  remix_refused: { vi: "Không remix theo yêu cầu này.", en: "Can't remix with this request." },
  remix_unclear: { vi: "Chưa hiểu yêu cầu remix.", en: "Couldn't understand the remix request." },
  template_not_found: { vi: "Mẫu không tồn tại.", en: "Template not found." },
  photo_too_large: { vi: "Ảnh quá lớn.", en: "The photo is too large." },
  photo_not_image: { vi: "File không phải ảnh.", en: "That file is not an image." },
  photo_limit: { vi: "Đã đạt giới hạn tải ảnh ({max} ảnh mỗi người, hoặc app đã đủ ảnh).", en: "Photo upload limit reached ({max} per person, or the app is full)." },
  likes_limit: { vi: "Bạn đã thích tối đa {max} mục.", en: "You have liked the maximum of {max} entries." },
  phishing_suggestion: {
    vi: 'MinintApp không tạo app thu thập mật khẩu, OTP, số thẻ hay mạo danh ngân hàng/ví. Thử: "Tạo quiz 3 câu về cách nhận biết tin nhắn lừa đảo".',
    en: 'MinintApp does not create apps that collect passwords, OTPs, card numbers or impersonate banks/wallets. Try: "A 3-question quiz on spotting scam messages".',
  },
} as const satisfies Record<string, Record<Locale, string>>;

export type ErrorCode = keyof typeof MESSAGES;
export type ErrorParams = Record<string, string | number>;
export const ERROR_CODES = Object.keys(MESSAGES) as ErrorCode[];

export const isErrorCode = (code: unknown): code is ErrorCode => typeof code === "string" && Object.hasOwn(MESSAGES, code);

/** Text for a code in the viewer's language; unknown codes get the generic line. */
export function errorText(code: string | null | undefined, locale: Locale, params: ErrorParams = {}): string {
  const template = MESSAGES[isErrorCode(code) ? code : "unknown"][locale];
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? ""));
}
