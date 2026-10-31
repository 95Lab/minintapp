// Standalone "app ended" page (shareable link target). A still-running app redirects to its live page.
import { redirect } from "next/navigation";
import { ExpiredNotice } from "@/engine-ui/lifecycle/expired-notice";
import { appsRepository, isUsable } from "@/engine/db/apps-repository";
import { goneBody } from "@/engine/api/route-helpers";

export default async function ExpiredPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const app = await appsRepository().findApp(id);
  const locale = app?.spec.locale ?? "vi";
  if (isUsable(app)) redirect(`/rooms/${id}`);
  return <ExpiredNotice gone={goneBody(app)} locale={locale} />;
}
