"use client";
import { useState } from "react";
import type { HostBlockProps, ParticipantBlockProps, PublicBlockOf } from "./block-ui-types";
import { WheelVisual } from "./wheel-visual";
export function WheelBlock({ block, runtime, open, onSubmit }: ParticipantBlockProps<PublicBlockOf<"wheel">>) {
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  return <section className="mini-card"><h2>{block.title}</h2><WheelVisual entries={block.options} winner={runtime.blocks[block.id]?.spins?.at(-1)?.label} />{block.source === "participants" && <button disabled={!open || busy || !onSubmit} onClick={async () => {
    if (!onSubmit || busy) return; setBusy(true);
    try { setMessage(await onSubmit("", { kind: "wheel", join: true }) ? "Đã tham gia." : "Không thể tham gia."); } catch { setMessage("Không thể tham gia."); } finally { setBusy(false); }
  }}>Tham gia bốc thăm</button>}<p role="status">{message}</p></section>;
}

export function WheelBlockHost({ block, runtime, canControl, busy, onAction }: HostBlockProps<PublicBlockOf<"wheel">>) {
  const [pending, setPending] = useState(false); const [error, setError] = useState("");
  async function run(action: string) {
    if (!onAction || pending || busy || !canControl) return;
    setPending(true); setError("");
    try { await onAction(action); } catch { setError("Không thể điều khiển vòng quay."); } finally { setPending(false); }
  }
  return <section className="mini-card"><h2>{block.title}</h2><WheelVisual entries={block.options} winner={runtime.blocks[block.id]?.spins?.at(-1)?.label} /><div className="mini-actions"><button disabled={!canControl || busy || pending || !onAction} onClick={() => run("spin")}>Quay số</button><button disabled={!canControl || busy || pending || !onAction} onClick={() => run("reset")}>Đặt lại vòng quay</button></div>{error && <p role="alert">{error}</p>}</section>;
}
