// Word cloud: font size scales with how many people gave the same answer. Pure presentation;
// grouping and profanity filtering happen on the server (open-text-block.ts).
export function WordCloud({ words, big = false }: { words: Array<{ text: string; count: number }>; big?: boolean }) {
  if (words.length === 0) return <p className="muted" style={{ margin: 0 }}>—</p>;
  const max = Math.max(...words.map((w) => w.count));
  const [minPx, maxPx] = big ? [18, 72] : [14, 36];
  return (
    <div className="word-cloud" aria-label="Word cloud">
      {words.map((w, i) => {
        const weight = max === 1 ? 0.5 : (w.count - 1) / (max - 1);
        return (
          <span
            key={w.text}
            className="word-cloud-word"
            title={`${w.text}: ${w.count}`}
            style={{ fontSize: `${Math.round(minPx + weight * (maxPx - minPx))}px`, opacity: 0.55 + weight * 0.45, order: i % 2 ? i : -i }}
          >
            {w.text}
          </span>
        );
      })}
    </div>
  );
}
