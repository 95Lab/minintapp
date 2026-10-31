"use client";
import { useEffect, useState } from "react";
import type { ComposeBlock } from "@/lib/blocks/compose/compose-block";
import type { AppRuntime } from "@/lib/blocks/block-definition-types";
import type { HostBlockProps } from "./block-ui-types";
export function ComposeSteps({ block, runtime }: { block: ComposeBlock; runtime: AppRuntime }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(timer); }, []);
  const step = runtime.blocks[block.id]?.step;
  const input = block.inputs.find((i) => i.id === step?.current);
  const remaining = input?.timeLimitSec && step?.openedAt != null && now !== null ? Math.max(0, Math.ceil((step.openedAt + input.timeLimitSec * 1000 - now) / 1000)) : null;
  return <div><p>{input ? `Bước ${block.inputs.indexOf(input) + 1}/${block.inputs.length}: ${input.label}` : step?.done.length === block.inputs.length ? "Đã hoàn thành các bước." : "Chờ host mở bước tiếp theo."}</p>{remaining !== null && <p role="timer">{remaining > 0 ? `Còn ${remaining} giây` : "Đã hết thời gian."}</p>}</div>;
}
export function ComposeStepsHost({ block, runtime, canControl, busy, onAction }: HostBlockProps<ComposeBlock>) {
  const step = runtime.blocks[block.id]?.step;
  const completed = new Set([...(step?.done ?? []), ...(step?.current ? [step.current] : [])]);
  return <section className="mini-card"><h2>{block.title}</h2><p>{block.inputs.length} trường nhập · {block.views.length} chế độ xem</p>{block.flow === "steps" && <><ComposeSteps block={block} runtime={runtime} /><div className="mini-actions"><button disabled={!canControl || busy || completed.size === block.inputs.length} onClick={() => onAction?.("next").catch(() => {})}>Mở bước tiếp theo</button><button disabled={!canControl || busy || !step?.current} onClick={() => onAction?.("close").catch(() => {})}>Đóng bước hiện tại</button><button disabled={!canControl || busy} onClick={() => onAction?.("restart").catch(() => {})}>Bắt đầu lại các bước</button></div><p>Bắt đầu lại giữ các câu trả lời đã gửi.</p></>}</section>;
}
