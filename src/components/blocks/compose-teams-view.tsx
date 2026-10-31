import type { RowsViewProps } from "./block-ui-types";
export function ComposeTeamsView({ rows, title = "Danh sách nhóm" }: RowsViewProps) {
  return <section className="mini-card"><h3>{title}</h3>{rows.length ? <ul>{rows.map((row) => <li key={row.id}><strong>{row.label}</strong>{row.value !== undefined && <span>: {row.value}</span>}</li>)}</ul> : <p>Chưa có dữ liệu.</p>}</section>;
}
