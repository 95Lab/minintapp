// UI words for host accounts (sign-in, "My apps", header link), in the home screen's language toggle.
import type { UiLocale } from "./ui-strings-vi-en";

const vi = {
  signIn: "Đăng nhập",
  signOut: "Đăng xuất",
  myApps: "App của tôi",
  loginTitle: "Đăng nhập để giữ app lâu hơn",
  loginLead: "Không cần mật khẩu: chúng tôi gửi link đăng nhập qua email. Người tham gia không bao giờ cần tài khoản.",
  emailLabel: "Email của bạn",
  sendLink: "Gửi link đăng nhập",
  sending: "Đang gửi…",
  checkEmail: "Kiểm tra email để đăng nhập",
  checkEmailLead: "Nếu địa chỉ này nhận được thư, bấm link trong thư để vào. Link dùng được trên thiết bị này.",
  callbackWorking: "Đang đăng nhập…",
  callbackFailed: "Không đăng nhập được.",
  backToLogin: "Gửi lại link",
  claimedSome: (n: number) => `Đã lưu ${n} app trên thiết bị này vào tài khoản.`,
  myAppsTitle: "App của tôi",
  myAppsEmpty: "Chưa có app nào trong tài khoản. App bạn tạo khi đã đăng nhập sẽ hiện ở đây.",
  signedInAs: (email: string) => `Đang đăng nhập: ${email}`,
  openHost: "Mở trang host",
  extend7d: "Thêm 7 ngày",
  endApp: "Kết thúc",
  endAppConfirm: "Kết thúc app này và xoá câu trả lời?",
  expiresAt: "Hết hạn",
  statusActive: "Đang chạy",
  statusClosed: "Đã đóng",
  maxLifetimeNote: "App của tài khoản được giữ tối đa 90 ngày kể từ lúc tạo.",
  loading: "Đang tải…",
};

const en: typeof vi = {
  signIn: "Sign in",
  signOut: "Sign out",
  myApps: "My apps",
  loginTitle: "Sign in to keep apps longer",
  loginLead: "No password: we email you a sign-in link. Participants never need an account.",
  emailLabel: "Your email",
  sendLink: "Send sign-in link",
  sending: "Sending…",
  checkEmail: "Check your email to sign in",
  checkEmailLead: "If this address can receive mail, open the link in it. It works on this device.",
  callbackWorking: "Signing you in…",
  callbackFailed: "Couldn't sign you in.",
  backToLogin: "Send a new link",
  claimedSome: (n: number) => `Saved ${n} app(s) from this device to your account.`,
  myAppsTitle: "My apps",
  myAppsEmpty: "No apps in your account yet. Apps you create while signed in show up here.",
  signedInAs: (email: string) => `Signed in as ${email}`,
  openHost: "Open host page",
  extend7d: "Add 7 days",
  endApp: "End",
  endAppConfirm: "End this app and delete its answers?",
  expiresAt: "Expires",
  statusActive: "Live",
  statusClosed: "Closed",
  maxLifetimeNote: "Account apps are kept at most 90 days after they were created.",
  loading: "Loading…",
};

export const ACCOUNT_STRINGS: Record<UiLocale, typeof vi> = { vi, en };

/** The language the home screen's toggle saved (default vi). */
export function savedUiLocale(): UiLocale {
  try {
    return localStorage.getItem("minint:ui-locale") === "en" ? "en" : "vi";
  } catch {
    return "vi";
  }
}
