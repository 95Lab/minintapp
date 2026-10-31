// Human-readable text of an AI-written page, for the phishing scan: what people SEE (tags, scripts
// and styles stripped) and the string literals in its scripts (labels the page builds at run time).

const SCRIPT_BODY = /<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi;
const STRING_LITERAL = /(["'`])((?:\\.|(?!\1)[^\\])*)\1/g;

const decodeEntities = (s: string) => s.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'");

/** Text a person reads on the page, whitespace collapsed. */
export function visibleText(html: string): string {
  const stripped = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ");
  return decodeEntities(stripped).replace(/\s+/g, " ").trim();
}

/** Non-trivial string literals found in inline scripts. */
export function scriptStrings(html: string): string[] {
  const out: string[] = [];
  for (const script of html.matchAll(SCRIPT_BODY)) {
    for (const lit of script[1].matchAll(STRING_LITERAL)) if (lit[2].trim().length >= 3) out.push(lit[2]);
  }
  return out;
}
