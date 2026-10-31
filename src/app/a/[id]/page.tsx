import { PollRoom } from "@/components/poll-room";
import { redirectManagedParticipant } from "@/lib/control-plane/participant-redirect";
export default async function ParticipantPage({ params }: PageProps<"/a/[id]">) {
  const { id } = await params;
  await redirectManagedParticipant(id);
  return <PollRoom id={id} />;
}
