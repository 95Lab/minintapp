"use client";
import { useState } from "react";
import type { PublicAppSpec } from "@/lib/app-spec/strip-private-fields";
import type { AppRuntime } from "@/lib/blocks/block-definition-types";
import type { ResponsePayload } from "@/lib/blocks/block-registry";
import { BrandTopBar } from "@/components/brand-top-bar";
import { AppRendererParticipant } from "@/components/app-renderer-participant";
import { AppRendererHost } from "@/components/app-renderer-host";
import { HomeScreen } from "@/components/create/home-screen";
import { SharePanelQr } from "@/components/share/share-panel-qr";
import { IntegrationStatusBadge } from "@/components/integration-status-badge";
import { AnnouncementBanner } from "@/components/announcement-banner";
import { LoginForm } from "@/components/account/login-form";
import { AccountNav } from "@/components/account/account-nav";
import { MyApps } from "@/components/account/my-apps";
import { RemixPanel } from "@/components/remix/remix-panel";
import { ExpiredNotice } from "@/components/lifecycle/expired-notice";
import { ComposeMapView } from "@/components/blocks/compose-map-view";
import { ComposePhotoUpload } from "@/components/blocks/compose-photo-upload";
import { CustomBlock } from "@/components/blocks/custom-block";
import { LiveBlock } from "@/components/blocks/live-block";
import { PayeeForm } from "@/components/payee-form";
export function ComponentPreview({ spec, runtime }: { spec: PublicAppSpec; runtime: AppRuntime }) {
  const [answers, setAnswers] = useState<Record<string, ResponsePayload>>({});
  const [view, setView] = useState("participant");
  return <main className="component-preview"><BrandTopBar><AccountNav /></BrandTopBar><p className="brand">COMPONENT LIBRARY</p><h1>Thư viện component</h1><p>Bản xem thử giao diện. Câu trả lời chỉ lưu tạm trên trang này, không gọi AI hoặc lưu lên server.</p><IntegrationStatusBadge status="unconfigured" label="API ứng dụng" /><div className="mini-preview-grid"><div><section className="mini-card"><h2>Runtime</h2><label className="mini-field">Chế độ xem<select value={view} onChange={(e) => setView(e.target.value)}><option value="participant">Participant</option><option value="host">Host</option></select></label><AnnouncementBanner announcement={{ text: "Dữ liệu minh họa để kiểm tra component.", at: 0 }} />{view === "participant" ? <AppRendererParticipant spec={spec} runtime={runtime} open myAnswers={answers} onSubmit={async (blockId, itemId, payload) => { setAnswers((old) => ({ ...old, [`${blockId}:${itemId}`]: payload })); return true; }} /> : <AppRendererHost spec={spec} runtime={runtime} canControl={false} />}</section><HomeScreen templates={[{ id: "poll", title: "Bình chọn", description: "Lựa chọn và biểu đồ kết quả" }, { id: "quiz", title: "Quiz", description: "Câu hỏi và bảng xếp hạng" }]} /><details className="mini-card"><summary>Tài khoản, remix và lifecycle</summary><LoginForm /><MyApps apps={[]} /><RemixPanel /><ExpiredNotice /></details><details className="mini-card"><summary>Các điểm mở rộng chưa khả dụng</summary><ComposeMapView /><ComposePhotoUpload /><PayeeForm /><CustomBlock /><LiveBlock /></details></div><aside><SharePanelQr url="https://example.com/a/demo" /><p>QR dẫn đến địa chỉ minh họa, không phải ứng dụng đã được tạo.</p><a href="/api/health">Kiểm tra trạng thái hệ thống</a></aside></div></main>;
}
