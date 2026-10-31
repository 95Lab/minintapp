import { AppRendererParticipant } from "@/engine-ui/app-renderer-participant";

export const metadata = { title: "MinintApp", referrer: "no-referrer" as const };

export default async function ParticipantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // key: remount on remix hand-off so no state from the previous app leaks into the new one
  return <AppRendererParticipant key={id} appId={id} />;
}
