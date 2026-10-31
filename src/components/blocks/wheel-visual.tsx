export function WheelVisual({ entries, winner }: { entries: readonly { id: string; label: string }[]; winner?: string }) {
  return <div className="mini-wheel"><ul aria-label="Danh sách bốc thăm">{entries.map((e) => <li key={e.id}>{e.label}</li>)}</ul><p role="status">{winner ? `Kết quả: ${winner}` : "Chờ host quay số"}</p></div>;
}
