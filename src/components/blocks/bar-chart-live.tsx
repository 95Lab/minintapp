export function BarChartLive({ items }: { items: readonly { id: string; label: string; count: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return <ul className="mini-bars">{items.map((i) => <li key={i.id}><span>{i.label}: {i.count}</span><meter min={0} max={max} value={Math.max(0, i.count)} aria-label={i.label} /></li>)}</ul>;
}
