import { AppRendererHost } from "@/engine-ui/app-renderer-host";

export const metadata = { title: "Host · MinintApp", referrer: "no-referrer" as const };

export default async function HostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // key: remount after remix so the child app starts from a clean state
  return <AppRendererHost key={id} appId={id} />;
}
