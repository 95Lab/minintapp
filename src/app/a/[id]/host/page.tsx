import { PollRoom } from "@/components/poll-room";
export default async function HostPage({ params }: PageProps<"/a/[id]/host">) {
  const { id } = await params;
  return <PollRoom id={id} host />;
}
