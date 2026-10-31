"use client";
import { useRuntimeTranslation } from "@/lib/i18n/runtime-locale";
import { useEffect, useState } from "react";
import type { ComposeBlock } from "@/lib/blocks/compose/compose-block";
import type { AppRuntime } from "@/lib/blocks/block-definition-types";
import type { HostBlockProps } from "./block-ui-types";
export function ComposeSteps({ block, runtime }: { block: ComposeBlock; runtime: AppRuntime }) {
  const tr = useRuntimeTranslation();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(timer); }, []);
  const step = runtime.blocks[block.id]?.step;
  const input = block.inputs.find((i) => i.id === step?.current);
  const remaining = input?.timeLimitSec && step?.openedAt != null && now !== null ? Math.max(0, Math.ceil((step.openedAt + input.timeLimitSec * 1000 - now) / 1000)) : null;
  return <div><p>{input ? tr("Bước {current}/{total}: {label}", { current: block.inputs.indexOf(input) + 1, total: block.inputs.length, label: input.label }) : step?.done.length === block.inputs.length ? tr("Đã hoàn thành các bước.") : tr("Chờ host mở bước tiếp theo.")}</p>{remaining !== null && <p role="timer">{remaining > 0 ? tr("Còn {seconds} giây", { seconds: remaining }) : tr("Đã hết thời gian.")}</p>}</div>;
}
export function ComposeStepsHost({ block, runtime, canControl, busy, onAction }: HostBlockProps<ComposeBlock>) {
  const tr = useRuntimeTranslation();
  const step = runtime.blocks[block.id]?.step;
  const completed = new Set([...(step?.done ?? []), ...(step?.current ? [step.current] : [])]);
  return <section className="mini-card"><h2>{block.title}</h2><p>{tr("{inputs} trường nhập · {views} chế độ xem", { inputs: block.inputs.length, views: block.views.length })}</p>{block.flow === "steps" && <><ComposeSteps block={block} runtime={runtime} /><div className="mini-actions"><button disabled={!canControl || busy || completed.size === block.inputs.length} onClick={() => onAction?.("next").catch(() => {})}>{tr("Mở bước tiếp theo")}</button><button disabled={!canControl || busy || !step?.current} onClick={() => onAction?.("close").catch(() => {})}>{tr("Đóng bước hiện tại")}</button><button disabled={!canControl || busy} onClick={() => onAction?.("restart").catch(() => {})}>{tr("Bắt đầu lại các bước")}</button></div><p>{tr("Bắt đầu lại giữ các câu trả lời đã gửi.")}</p></>}</section>;
}
