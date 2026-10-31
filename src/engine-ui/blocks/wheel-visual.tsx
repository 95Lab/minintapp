"use client";
// SVG lucky wheel. When a new spin arrives (spinId changes) it rotates forward several turns and
// lands on the winner chosen by the SERVER — the animation is cosmetic, never the source of truth.
import { useEffect, useRef, useState } from "react";
import type { WheelSpin } from "@/engine/api/api-contract-types";

const SPIN_MS = 4200;
const SHADES = [100, 72, 86, 58];

export function WheelVisual({ entries, lastSpin, size = 320 }: { entries: Array<{ id: string; label: string }>; lastSpin: WheelSpin | null; size?: number }) {
  // Keep the last winner on the wheel while it animates, even if removeWinner took it out.
  const shown = lastSpin && !entries.some((e) => e.id === lastSpin.entryId) ? [...entries, { id: lastSpin.entryId, label: lastSpin.label }] : entries;
  const n = Math.max(shown.length, 1);
  const [rotation, setRotation] = useState(0);
  const [settled, setSettled] = useState(true);
  const seenSpin = useRef<string | null>(lastSpin?.spinId ?? null);

  useEffect(() => {
    if (!lastSpin || lastSpin.spinId === seenSpin.current) return;
    seenSpin.current = lastSpin.spinId;
    const index = Math.max(0, shown.findIndex((e) => e.id === lastSpin.entryId));
    const center = (index + 0.5) * (360 / n);
    setSettled(false);
    setRotation((prev) => prev - (prev % 360) + 360 * 6 + (360 - center));
    const t = setTimeout(() => setSettled(true), SPIN_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animate only when a new spin arrives
  }, [lastSpin?.spinId]);

  const r = 100;
  const slice = (2 * Math.PI) / n;
  return (
    <div className="wheel" style={{ width: "100%", maxWidth: size }}>
      <div className="wheel-pointer" aria-hidden="true" />
      <svg viewBox="-104 -104 208 208" role="img" aria-label={lastSpin && settled ? `Kết quả: ${lastSpin.label}` : "Vòng quay"}>
        <g className="wheel-rotor" style={{ transform: `rotate(${rotation}deg)`, transitionDuration: `${SPIN_MS}ms` }}>
          {shown.length === 0 && <circle r={r} fill="var(--surface-2)" />}
          {shown.map((e, i) => {
            const a0 = i * slice - Math.PI / 2;
            const a1 = a0 + slice;
            const large = slice > Math.PI ? 1 : 0;
            const path = n === 1 ? undefined : `M0 0 L${r * Math.cos(a0)} ${r * Math.sin(a0)} A${r} ${r} 0 ${large} 1 ${r * Math.cos(a1)} ${r * Math.sin(a1)} Z`;
            const mid = a0 + slice / 2;
            const label = e.label.length > 14 ? `${e.label.slice(0, 13)}…` : e.label;
            // Text runs along the radius; left-half labels are flipped so they never read upside down.
            const midDeg = (mid * 180) / Math.PI;
            const textAngle = Math.cos(mid) < 0 ? midDeg + 180 : midDeg;
            return (
              <g key={e.id}>
                {path ? (
                  <path d={path} fill={`color-mix(in srgb, var(--app) ${SHADES[i % SHADES.length]}%, var(--surface))`} stroke="var(--surface)" strokeWidth="0.8" />
                ) : (
                  <circle r={r} fill="var(--app)" />
                )}
                <text
                  x={r * 0.6 * Math.cos(mid)}
                  y={r * 0.6 * Math.sin(mid)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={n > 12 ? 6 : 8}
                  fontWeight="700"
                  fill="#fff"
                  transform={`rotate(${textAngle} ${r * 0.6 * Math.cos(mid)} ${r * 0.6 * Math.sin(mid)})`}
                >
                  {label}
                </text>
              </g>
            );
          })}
        </g>
        <circle r="10" fill="var(--surface)" stroke="var(--ink)" strokeWidth="1.5" />
      </svg>
      {lastSpin && settled && <div className="wheel-result">{lastSpin.label}</div>}
    </div>
  );
}
