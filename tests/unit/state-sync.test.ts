import { afterEach, describe, expect, it, vi } from "vitest";
import { startStateSync, type ChannelStatus, type Subscribe } from "@/lib/realtime/state-sync";
const config = { mode: "supabase" as const, url: "https://test.supabase.co", publicKey: "sb_publishable_test", channel: "app:opaque" };
afterEach(() => { vi.useRealTimers(); });
function setup(mode: "supabase" | "memory" = "supabase", refresh = vi.fn(async () => true)) {
  vi.useFakeTimers(); let changed!: () => void, status!: (s: ChannelStatus) => void;
  const cleanup = vi.fn();
  const subscribe: Subscribe = vi.fn((_, c, s) => { changed = c; status = s; return cleanup; });
  const events = new EventTarget(); const stop = startStateSync({ sync: mode === "supabase" ? config : { mode }, refresh, subscribe, events });
  return { changed: () => changed(), status: (s: ChannelStatus) => status(s), stop, refresh, events, cleanup, subscribe };
}
describe("realtime state synchronization", () => {
  it("refreshes on join and broadcast, coalesces bursts and never polls a healthy channel", async () => {
    const s = setup(); s.status("SUBSCRIBED"); await vi.advanceTimersByTimeAsync(50);
    expect(s.refresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60000); expect(s.refresh).toHaveBeenCalledTimes(1);
    s.changed(); s.changed(); s.changed(); await vi.advanceTimersByTimeAsync(50);
    expect(s.refresh).toHaveBeenCalledTimes(2); s.stop(); expect(s.cleanup).toHaveBeenCalledTimes(1);
    s.changed(); await vi.advanceTimersByTimeAsync(20000); expect(s.refresh).toHaveBeenCalledTimes(2);
  });
  it("uses slow fallback on disconnect and reconciles when reconnected or focused", async () => {
    const s = setup(); s.status("CHANNEL_ERROR"); await vi.advanceTimersByTimeAsync(10100);
    expect(s.refresh).toHaveBeenCalledTimes(1);
    s.status("SUBSCRIBED"); await vi.advanceTimersByTimeAsync(50);
    expect(s.refresh).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(20000); expect(s.refresh).toHaveBeenCalledTimes(2);
    s.events.dispatchEvent(new Event("focus")); await vi.advanceTimersByTimeAsync(50);
    expect(s.refresh).toHaveBeenCalledTimes(3); s.stop();
  });
  it("retries a state fetch failure even when websocket stays healthy", async () => {
    const refresh = vi.fn(async () => true).mockResolvedValueOnce(false); const s = setup("supabase", refresh);
    s.status("SUBSCRIBED"); await vi.advanceTimersByTimeAsync(10100);
    expect(refresh).toHaveBeenCalledTimes(2); s.stop();
  });
  it("keeps offline memory mode polling without subscribing", async () => {
    const s = setup("memory"); await vi.advanceTimersByTimeAsync(3200);
    expect(s.refresh).toHaveBeenCalledTimes(2); expect(s.subscribe).not.toHaveBeenCalled(); s.stop();
  });
  it("queues a trailing fetch when a notification arrives during a state read", async () => {
    let done!: (value: boolean) => void;
    const refresh = vi.fn(() => new Promise<boolean>((resolve) => { done = resolve; })); const s = setup("supabase", refresh);
    s.status("SUBSCRIBED"); await vi.advanceTimersByTimeAsync(50); s.changed(); s.changed();
    done(true); await vi.advanceTimersByTimeAsync(50); expect(refresh).toHaveBeenCalledTimes(2);
    s.stop(); done(true); await vi.advanceTimersByTimeAsync(20000); expect(refresh).toHaveBeenCalledTimes(2);
  });
});

it("does not postpone fallback indefinitely during repeated connection errors", async () => {
  const s = setup();
  for (let i = 0; i < 4; i++) { s.status("CHANNEL_ERROR"); await vi.advanceTimersByTimeAsync(3000); }
  expect(s.refresh).toHaveBeenCalledTimes(1); s.stop();
});
