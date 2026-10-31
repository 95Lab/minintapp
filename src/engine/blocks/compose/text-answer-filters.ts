// Filters for short free-text answers that end up on a projector: links are rejected, a small VN/EN
// profanity list is dropped from word clouds, and answers are grouped into a cloud.
export const LINK_LIKE = /https?:\/\/|www\.|\.(com|vn|net|org|io|xyz)\b/i;

const MAX_WORDS_IN_CLOUD = 40;
// Minimal projector-safety list; the host can always close the app. Matched on folded text.
const BLOCKED_WORDS = ["dit", "dm", "dmm", "vcl", "vl", "cac", "lon", "buoi", "dcm", "fuck", "shit", "bitch", "cunt", "dick"];

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase();

export function isBlockedAnswer(text: string): boolean {
  const tokens = fold(text).split(/[^a-z0-9]+/).filter(Boolean);
  return tokens.some((t) => BLOCKED_WORDS.includes(t));
}

export const wordCount = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);

/** Groups answers whitespace/case-insensitively ("Vui " == "vui"), most frequent first, max 40. */
export function wordCloud(texts: string[]): Array<{ text: string; count: number }> {
  const groups = new Map<string, { text: string; count: number }>();
  for (const raw of texts) {
    const text = raw.normalize("NFC").trim().replace(/\s+/g, " ");
    if (!text || isBlockedAnswer(text)) continue;
    const key = text.toLocaleLowerCase("vi");
    const g = groups.get(key) ?? { text, count: 0 };
    g.count += 1;
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || a.text.localeCompare(b.text, "vi")).slice(0, MAX_WORDS_IN_CLOUD);
}
