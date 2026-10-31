"use client";
// Wheel brick UI. Host: big wheel + Spin / Reset + entrant count. Participant: sees the same wheel
// spin live; for "participants" wheels, a Join button adds them to the draw.
import { useState } from "react";
import type { WheelResults } from "@/engine/api/api-contract-types";
import type { PublicBlock } from "@/engine/app-spec/strip-private-fields";
import { t } from "@/engine/i18n/ui-strings-vi-en";
import { WheelVisual } from "./wheel-visual";
import type { HostBlockProps, ParticipantBlockProps } from "./block-ui-types";

type Wheel = Extract<PublicBlock, { type: "wheel" }>;

function lastSpin(results: WheelResults | null) {
  return results?.spins.at(-1) ?? null;
}

export function WheelBlockHost({ block, results, locale, busy, canControl, onAction }: HostBlockProps<Wheel, WheelResults>) {
  const s = t(locale);
  const count = results?.entries.length ?? 0;
  return (
    <div style={{ display: "grid", gap: 16, justifyItems: "center" }}>
      <div className="big-q" style={{ marginBottom: 0, justifySelf: "stretch" }}>{block.title}</div>
      <WheelVisual entries={results?.entries ?? []} lastSpin={lastSpin(results)} size={460} />
      <div className="muted num">{block.source === "participants" ? s.wheelEntrants(count) : s.wheelSlots(count)}</div>
      {canControl && (
        <div className="toolbar">
          <button className="btn btn-app btn-lg" disabled={busy || count === 0} onClick={() => onAction("spin")}>{s.wheelSpin}</button>
          {(results?.spins.length ?? 0) > 0 && (
            <button className="btn" disabled={busy} onClick={() => onAction("reset")}>{s.wheelReset}</button>
          )}
        </div>
      )}
      {(results?.spins.length ?? 0) > 1 && (
        <div className="tally">
          {results!.spins.slice(0, -1).reverse().slice(0, 8).map((sp) => (
            <span key={sp.spinId} className="pill">{sp.label}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export function WheelBlock({ block, results, myAnswers, open, locale, onSubmit }: ParticipantBlockProps<Wheel, WheelResults>) {
  const s = t(locale);
  const joined = !!myAnswers[`${block.id}:`];
  const [busy, setBusy] = useState(false);
  return (
    <section className="card p-card" style={{ justifyItems: "center" }}>
      <h2 style={{ fontSize: 21, justifySelf: "stretch" }}>{block.title}</h2>
      <WheelVisual entries={results?.entries ?? []} lastSpin={lastSpin(results)} size={300} />
      {block.source === "participants" &&
        (joined ? (
          <div className="status-line">{s.wheelJoined}</div>
        ) : (
          <button
            className="btn btn-app btn-lg"
            disabled={!open || busy}
            onClick={async () => {
              setBusy(true);
              await onSubmit("", { kind: "wheel", join: true });
              setBusy(false);
            }}
          >
            {s.wheelJoin}
          </button>
        ))}
    </section>
  );
}
