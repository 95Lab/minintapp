// Horizontal bar chart used by host and participant result views. Bars share one scale
// (the largest count), animate on change, and the leader is highlighted.
export interface BarDatum {
  id: string;
  label: string;
  value: number;
  correct?: boolean;
}

export function BarChartLive({ data, total, highlightWinner = true }: { data: BarDatum[]; total: number; highlightWinner?: boolean }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const top = Math.max(...data.map((d) => d.value));
  return (
    <div className="bars">
      {data.map((d) => {
        const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
        const win = highlightWinner && d.value > 0 && d.value === top;
        return (
          <div key={d.id} className={`bar-row${win ? " win" : ""}${d.correct ? " opt-correct" : ""}`}>
            <div className="bar-label">
              <span>{d.label}</span>
              <span className="num">
                {d.value} <span className="muted" style={{ fontWeight: 500 }}>· {pct}%</span>
              </span>
            </div>
            <div className="bar-track" role="presentation">
              <div className="bar-fill" style={{ width: `${(d.value / max) * 100}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const formatVnd = (n: number) => `${new Intl.NumberFormat("vi-VN").format(n)}đ`;
