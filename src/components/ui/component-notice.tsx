export interface ComponentNoticeProps { title: string; children?: React.ReactNode }
export function ComponentNotice({ title, children }: ComponentNoticeProps) {
  return <section className="mini-card mini-notice"><h3>{title}</h3><p>{children ?? "Chức năng này chưa được kết nối. Sẽ khả dụng ở giai đoạn tiếp theo."}</p></section>;
}
