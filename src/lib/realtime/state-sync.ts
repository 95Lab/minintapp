import type { AppSync } from "@/lib/api/api-contract-types";
export type ChannelStatus = "SUBSCRIBED" | "CHANNEL_ERROR" | "TIMED_OUT" | "CLOSED";
export type Subscribe = (sync: Extract<AppSync, { mode: "supabase" }>, changed: () => void, status: (status: ChannelStatus) => void) => () => void;
// No regular HTTP polling on a healthy Realtime connection. Reconcile after join/rejoin,
// network recovery and tab focus; use a slow fallback only while the connection is down.
export function startStateSync({ sync, refresh, subscribe, events }: {
  sync: AppSync; refresh: () => Promise<boolean>; subscribe: Subscribe;
  events: Pick<EventTarget, "addEventListener" | "removeEventListener">;
}) {
  let stopped = false, connected = false, running = false, queued = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let fallback: ReturnType<typeof setTimeout> | undefined;
  const fallbackDelay = () => sync.mode === "memory" ? 1500 : 10000;
  const clearFallback = () => { clearTimeout(fallback); fallback = undefined; };
  const scheduleFallback = (evenIfConnected = false) => {
    if (!stopped && (!connected || evenIfConnected) && fallback === undefined) fallback = setTimeout(() => { fallback = undefined; request(); }, fallbackDelay());
  };
  async function run() {
    if (stopped || running) { queued = !stopped; return; }
    running = true;
    let ok = false;
    try { ok = await refresh(); } catch { /* Retry transient state read failures. */ }
    running = false;
    if (stopped) return;
    if (!ok) scheduleFallback(true);
    else if (connected) clearFallback();
    else scheduleFallback();
    if (queued) { queued = false; request(); }
  }
  function request() {
    if (stopped) return;
    if (running) { queued = true; return; }
    clearTimeout(timer); timer = setTimeout(() => void run(), 40);
  }
  const remove = sync.mode === "supabase" ? subscribe(sync, request, (status) => {
    connected = status === "SUBSCRIBED";
    if (connected) { clearFallback(); request(); }
    else scheduleFallback();
  }) : () => {};
  events.addEventListener("online", request); events.addEventListener("focus", request);
  scheduleFallback();
  return () => { stopped = true; clearTimeout(timer); clearTimeout(fallback); remove(); events.removeEventListener("online", request); events.removeEventListener("focus", request); };
}
