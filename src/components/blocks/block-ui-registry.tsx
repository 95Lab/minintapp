import { QuizBlockHost } from "./quiz-block-host";
import type { HostBlockProps, ParticipantBlockProps } from "./block-ui-types";
import { ComposeBlock } from "./compose-block";
import { QuizBlock } from "./quiz-block";
import { WheelBlock, WheelBlockHost } from "./wheel-block";
export const BLOCK_UI_TYPES = ["compose", "quiz", "wheel"] as const;
export function ParticipantBlock(props: ParticipantBlockProps) {
  const block = props.block;
  switch (block.type) {
    case "compose": return <ComposeBlock {...props} block={block} />;
    case "quiz": return <QuizBlock {...props} block={block} />;
    case "wheel": return <WheelBlock {...props} block={block} />;
  }
}

export function HostBlock(props: HostBlockProps) {
  const block = props.block;
  switch (block.type) {
    case "quiz": return <QuizBlockHost {...props} block={block} />;
    case "wheel": return <WheelBlockHost {...props} block={block} />;
    case "compose": return <section className="mini-card"><h2>{block.title}</h2><p>{block.inputs.length} trường nhập · {block.views.length} chế độ xem</p></section>;
  }
}
