"use client";
// Live countdown to expires_at. Shows d/h/m/s depending on how far away expiry is.
import { useEffect, useState } from "react";

function format(ms: number) {
  if (ms <= 0) return "0:00";
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}

export function ExpiryCountdown({ expiresAt, label }: { expiresAt: string; label: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = new Date(expiresAt).getTime() - now;
  return (
    <span className="pill num" title={new Date(expiresAt).toLocaleString()}>
      {label} {format(left)}
    </span>
  );
}
