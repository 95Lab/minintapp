"use client";
// Shows which integrations are live (from GET /api/health) so a mock generator or in-memory
// store is never mistaken for the real thing during a demo.
import { useEffect, useState } from "react";

export interface HealthStatus {
  storage: "supabase" | "memory" | "postgresql" | "sqlite";
  storageOk: boolean;
  /** provider id ("openai", "gemini", …) or "mock" */
  generator: string;
  generatorLabel: string | null;
  model: string | null;
  realtime: "supabase" | "polling";
  simulate: boolean;
}

export function fetchHealth(): Promise<HealthStatus | null> {
  return fetch("/api/engine/health", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<HealthStatus>) : null))
    .catch(() => null);
}

/** Re-checks every 30 s so a recovered (or failed) Supabase shows up without a reload. */
export function useHealth() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => fetchHealth().then((h) => alive && setHealth(h));
    load();
    const id = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  return health;
}

export function IntegrationStatusBadge() {
  const h = useHealth();
  if (!h) return null;
  const mock = h.generator === "mock" || h.storage === "memory";
  const label = [
    h.generator === "mock" ? "Generator giả lập" : `${h.generatorLabel ?? h.generator} · ${h.model}`,
    h.storage === "supabase" ? (h.storageOk ? "Supabase" : "Supabase lỗi") : h.storage === "postgresql" ? "PostgreSQL + SQLite" : h.storage === "sqlite" ? "SQLite" : "Bộ nhớ tạm",
    h.realtime === "supabase" ? "Realtime" : "Polling",
  ].join(" · ");
  return (
    <span className={`pill ${mock || !h.storageOk ? "preview" : ""}`} title="Trạng thái tích hợp (GET /api/health)">
      {label}
    </span>
  );
}
