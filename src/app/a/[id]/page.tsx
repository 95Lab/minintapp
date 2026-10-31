import { PollRoom } from "@/components/poll-room";
export default async function ParticipantPage({ params }: PageProps<"/a/[id]">) {
  const { id } = await params;
  return <PollRoom id={id} />;
}
