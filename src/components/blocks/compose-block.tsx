import type { ComposeBlock as ComposeSpec } from "@/lib/blocks/compose/compose-block";
import type { ParticipantBlockProps } from "./block-ui-types";
import { ComposeRecordForm } from "./compose-record-form";
export function ComposeBlock({ block, open, onSubmit, myAnswers }: ParticipantBlockProps<ComposeSpec>) {
  const saved = myAnswers?.[`${block.id}:`];
  return <section className="mini-card"><h2>{block.title}</h2>{block.note && <p>{block.note}</p>}<ComposeRecordForm key={block.id} inputs={block.inputs} disabled={!open} initialValues={saved?.kind === "compose" ? saved.values : {}} onSubmit={onSubmit ? (payload) => onSubmit("", payload) : undefined} /></section>;
}
