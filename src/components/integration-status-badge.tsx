export function IntegrationStatusBadge({ status, label }: { status: "connected" | "offline" | "unconfigured"; label: string }) {
  return <span role="status" className={`mini-badge mini-${status}`}>{label}: {status === "connected" ? "Đã kết nối" : status === "offline" ? "Mất kết nối" : "Chưa cấu hình"}</span>;
}
