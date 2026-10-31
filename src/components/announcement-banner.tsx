export function AnnouncementBanner({ announcement }: { announcement: { text: string; at: number } | null }) {
  return announcement ? <aside className="mini-notice" aria-label="Thông báo từ host"><strong>Thông báo</strong><p>{announcement.text}</p></aside> : null;
}
