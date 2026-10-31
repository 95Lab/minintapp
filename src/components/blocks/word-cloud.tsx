export function WordCloud({ words }: { words: readonly { text: string; count: number }[] }) {
  return <ul className="mini-cloud" aria-label="Các từ được gửi">{words.map((w) => <li key={w.text} style={{ fontSize: `${Math.min(2.5, 1 + Math.log2(Math.max(1, w.count)) * .2)}rem` }}>{w.text} <small>({w.count})</small></li>)}</ul>;
}
