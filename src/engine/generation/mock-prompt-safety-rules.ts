// Prompt-level rules used by the mock generator: locale detection and credential-harvesting
// (phishing) detection. The real security phase moves the phishing scan to scanAppSpec +
// model riskFlags; these rules also serve as its first VN/EN keyword list.
import type { Locale } from "@/engine/app-spec/app-spec-schema";
import type { LlmOutput } from "./llm-output-types";

const VI_CHARS = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
const BRANDS = "vietcombank|techcombank|bidv|agribank|vietinbank|mb ?bank|tpbank|vpbank|momo|zalopay|shopee|facebook|zalo";
const CREDENTIALS = "mật khẩu|mat khau|password|otp|mã pin|số thẻ|so the|thẻ tín dụng|cvv|cccd|số tài khoản|stk";

// A topic like "quiz về an toàn mật khẩu" is fine; asking people to *enter* credentials, or
// pairing a bank/wallet brand with login/prize wording, is not.
const PHISHING = [
  new RegExp(`(đăng nhập|dang nhap|login|sign in|nhập|nhap|điền|enter|thu thập|collect|xác minh|verify).{0,40}(${CREDENTIALS})`, "i"),
  new RegExp(`(${BRANDS}).{0,40}(đăng nhập|login|nhận quà|nhan qua|xác minh|verify|trúng thưởng)`, "i"),
  new RegExp(`(đăng nhập|login|nhận quà|xác minh|verify).{0,40}(${BRANDS})`, "i"),
];

export function detectLocale(text: string): Locale {
  return VI_CHARS.test(text) ? "vi" : "en";
}

export const looksLikePhishing = (text: string) => PHISHING.some((re) => re.test(text));

export const refuseCredentialHarvesting = (locale: Locale): LlmOutput => ({
  outcome: "refused",
  spec: null,
  suggestion:
    locale === "vi"
      ? "MinintApp không tạo app thu thập mật khẩu, OTP, số thẻ hay mạo danh ngân hàng/ví. Thử: \"Tạo quiz 3 câu về cách nhận biết tin nhắn lừa đảo\"."
      : "MinintApp won't build apps that collect passwords, OTPs, card numbers or impersonate banks/wallets. Try: \"A 3-question quiz on spotting scam messages\".",
  riskFlags: ["credential_request", "impersonation"],
});
