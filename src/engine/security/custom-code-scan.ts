// Static refusal list for the AI-written page of a `custom` block (T9 in the threat model). The real
// containment is the sandbox (opaque-origin iframe + CSP without network, see sandbox-headers.ts);
// this scan only keeps code that is obviously trying to leave it, harvest credentials or load
// anything remote from ever being stored. It is a filter, not a proof: obfuscated code gets past it
// and is stopped by the sandbox instead.
//
// Returns issue codes; an empty list means the page may be stored.

export const CUSTOM_HTML_MAX_CHARS = 12_000;

/** Markup that could submit data, embed other pages, or change where relative things point. */
const MARKUP_PATTERNS: Array<[string, RegExp]> = [
  ["tag:form", /<\s*form\b/i],
  ["tag:iframe", /<\s*iframe\b/i],
  ["tag:object", /<\s*object\b/i],
  ["tag:embed", /<\s*embed\b/i],
  ["tag:base", /<\s*base\b/i],
  ["tag:link", /<\s*link\b/i],
  ["tag:meta_http_equiv", /<\s*meta\b[^>]*http-equiv/i],
  ["tag:external_script", /<\s*script\b[^>]*\bsrc\s*=/i],
  ["url:absolute", /https?:\/\//i],
  // protocol-relative address ("//host/…") in a string, attribute or css url()
  ["url:protocol_relative", /["'`]\s*\/\/[\w.-]|\burl\(\s*["']?\s*\/\//i],
];

/** JavaScript that touches the network, storage, navigation, other windows or dynamic code. Case-sensitive. */
const SCRIPT_PATTERNS: Array<[string, RegExp]> = [
  ["js:top_or_parent_location", /\b(?:top|parent)\s*\.\s*location|\b(?:top|parent)\s*\[\s*["']location/],
  // The page may navigate itself, so any way of setting its own location is refused (containment is the
  // parent's frame-src, the iframe-only route and the opaque origin; this keeps the obvious attempts out).
  ["js:location", /\blocation\s*(?:=(?!=)|\.\s*(?:replace|assign|href)\b|\[)|\b(?:document|window|self|globalThis)\s*(?:\.\s*location\b|\[\s*["'`]location)/],
  ["js:document_domain", /\bdocument\s*\.\s*domain\b/],
  ["js:history", /\bhistory\s*(?:\.|\[)/],
  ["js:window_name", /\b(?:window|self)\s*\.\s*name\b/],
  ["js:window_open", /\bwindow\s*\.\s*open\b|\bopen\s*\(\s*["'`]/],
  ["js:cookie", /\bdocument\s*\.\s*cookie\b/],
  ["js:storage", /\b(?:localStorage|sessionStorage|indexedDB)\b/],
  ["js:fetch", /\bfetch\s*\(/],
  ["js:xhr", /\bXMLHttpRequest\b/],
  ["js:websocket", /\bWebSocket\b|\bEventSource\b/],
  ["js:beacon", /\bsendBeacon\b/],
  ["js:import_scripts", /\bimportScripts\b|\bimport\s*\(/],
  ["js:worker", /\bnew\s+(?:Shared)?Worker\b/],
  ["js:eval", /\beval\s*\(/],
  ["js:function_constructor", /\bFunction\s*\(/],
];

/** Credential / payment wording (vi + en): a game never needs them, a phishing page always does. */
const CREDENTIAL_WORDS = /mật khẩu|\botp\b|mã xác nhận|mã xác thực|số thẻ|\bcvv\b|\bpassword\b|\bpin\b/i;

export function scanCustomCode(html: string): string[] {
  const issues: string[] = [];
  if (html.length > CUSTOM_HTML_MAX_CHARS) issues.push("too_large");
  const text = html.normalize("NFC");
  for (const [code, re] of MARKUP_PATTERNS) if (re.test(text)) issues.push(code);
  for (const [code, re] of SCRIPT_PATTERNS) if (re.test(text)) issues.push(code);
  if (CREDENTIAL_WORDS.test(text)) issues.push("credential_wording");
  return issues;
}
