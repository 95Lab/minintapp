// VN/EN keyword matchers for scan-app-spec-phishing.ts. Every matcher tests the NFC text AND a
// "folded" copy (diacritics stripped, đ→d, lower-case), so "khoá"/"khóa"/"khoa" and
// "mật khẩu"/"mat khau" all match the same rule. Extend the lists after real drills
// (eval/phishing-prompts-external.jsonl) without touching the scanning logic.

/** Strip Vietnamese diacritics so accent-free typing can't dodge the rules. */
export function foldVietnamese(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

export type TextMatcher = (text: string) => boolean;

function matcher(pattern: string): TextMatcher {
  const exact = new RegExp(pattern, "i");
  const folded = new RegExp(foldVietnamese(pattern), "i");
  return (text) => exact.test(text.normalize("NFC")) || folded.test(foldVietnamese(text));
}

/** Credential nouns: presence alone flags a form field or select option, because that structural
 * context (a field/option label) is inherently "please provide this value". */
const CREDENTIAL_NOUN_PATTERNS = [
  "mật khẩu",
  "\\bmk\\b",
  "\\bpass\\b",
  "mã pin",
  "số pin",
  "mã otp",
  "\\botp\\b",
  "mã xác nhận",
  "mã xác thực",
  "số thẻ",
  "thẻ tín dụng",
  "thẻ ghi nợ",
  "\\bcvv\\b",
  "\\bcvc\\b",
  "cccd",
  "căn cước",
  "số tài khoản",
  "\\bstk\\b",
  "tài khoản ngân hàng",
  "\\bpassword\\b",
  "passcode",
  "pin code",
  "one[- ]time password",
  "verification code",
  "card number",
  "credit card",
  "\\bssn\\b",
  "social security",
  "account number",
  "bank account",
  "routing number",
];
const CREDENTIAL_NOUNS = CREDENTIAL_NOUN_PATTERNS.join("|");
export const hasCredentialNoun = matcher(CREDENTIAL_NOUNS);

/** Action verb + credential noun within a short span: used for option labels, questions and block
 * titles, where the noun alone is too weak (a quiz *about* passwords is not phishing bait). */
const ACTION_VERBS = ["nhập", "điền", "cung cấp", "gửi", "gõ", "xác nhận", "enter", "provide", "type", "input", "send", "confirm"];
export const hasCredentialAction = matcher(`(${ACTION_VERBS.join("|")})\\s+[^.?!\\n]{0,30}?(${CREDENTIAL_NOUNS})`);

/** Named VN bank/e-wallet brands plus generic "bank"/"wallet" category words. */
const BRAND_PATTERNS = [
  "vietcombank",
  "vietinbank",
  "\\bbidv\\b",
  "agribank",
  "\\bacb\\b",
  "sacombank",
  "techcombank",
  "vpbank",
  "tpbank",
  "\\bshb\\b",
  "\\bocb\\b",
  "\\bhsbc\\b",
  "mb ?bank",
  "momo",
  "zalopay",
  "viettelpay",
  "shopeepay",
  "vnpay",
  "\\btimo\\b",
  "ngân hàng",
  "ví điện tử",
  "e-?wallet",
  "\\bbank(ing)?\\b",
];
export const hasBankOrWalletBrand = matcher(BRAND_PATTERNS.join("|"));

/** Login/prize wording that, combined with a brand mention, is classic phishing bait. */
const LOGIN_OR_PRIZE_PATTERNS = [
  "đăng nhập",
  "xác thực tài khoản",
  "xác minh tài khoản",
  "khóa tài khoản",
  "mở khóa tài khoản",
  "nhận thưởng",
  "trúng thưởng",
  "nhận quà",
  "quà tặng",
  "claim your prize",
  "login now",
  "log ?in",
  "sign in",
  "verify your account",
  "winner",
  "you('|’)?ve won",
  "congratulations",
];
export const hasLoginOrPrizeWording = matcher(LOGIN_OR_PRIZE_PATTERNS.join("|"));

/** Any URL/domain-like text. AppSpec fields must never carry links (see app-spec-schema.ts),
 * so a hit anywhere is high-confidence regardless of surrounding wording. */
export const URL_LIKE_REGEX = /https?:\/\/|www\.|\.(com|vn|net|org|info|xyz|top|io)\b/i;

/** A bank account / card number typed into AI-written text: 9+ digits in a row, or card-style groups of four.
 * Real account numbers only ever come from the host's payee form, never from a generated spec. */
export const ACCOUNT_NUMBER_REGEX = /\d{9,}|\b\d{4}(?: \d{4}){2,}\b/;

/** "Transfer money to…" wording: weak alone (a quiz about scams says it too), strong next to a number. */
export const hasTransferInstruction = matcher("chuyển khoản|chuyển tiền (vào|cho|đến|tới)|bank transfer|wire transfer|transfer (money |funds )?to");
