import { expect, test, type BrowserContext, type WebSocketRoute } from "@playwright/test";

test("Supabase client refreshes independent devices from broadcast without healthy polling", async ({ browser, baseURL }) => {
  const sockets = new Set<{ ws: WebSocketRoute; topic: string; join: string | null }>();
  const contexts: BrowserContext[] = [];
  async function device() {
    const context = await browser.newContext(); contexts.push(context);
    await context.route("**/api/apps/*/state", async (route) => {
      const response = await route.fetch(); const state = await response.json();
      if (response.ok()) state.sync = { mode: "supabase", url: "https://realtime-test.supabase.co", publicKey: "sb_publishable_browser_test", channel: `app:${state.id}` };
      await route.fulfill({ response, json: state });
    });
    await context.routeWebSocket(/realtime-test\.supabase\.co\/realtime\/v1\/websocket/, (ws) => {
      let socket: { ws: WebSocketRoute; topic: string; join: string | null } | undefined;
      ws.onMessage((raw) => {
        const [join, ref, topic, event] = JSON.parse(String(raw));
        if (event === "phx_join") { socket = { ws, topic, join }; sockets.add(socket); }
        if (event === "phx_join" || event === "phx_leave" || event === "heartbeat") ws.send(JSON.stringify([join, ref, topic, "phx_reply", { status: "ok", response: {} }]));
      });
      ws.onClose(() => { if (socket) sockets.delete(socket); });
    });
    return context.newPage();
  }
  const notify = () => { for (const { ws, topic, join } of sockets) ws.send(JSON.stringify([join, null, topic, "broadcast", { event: "state_changed", payload: { version: 999999 }, type: "broadcast" }])); };
  try {
    const host = await device(); await host.goto(baseURL!);
    await host.getByRole("button", { name: "Tạo bình chọn mẫu", exact: true }).click();
    await expect(host).toHaveURL(/\/host$/); const id = host.url().split("/").at(-2)!;
    const player = await device(); await player.goto(`${baseURL}/a/${id}`);
    await expect.poll(() => sockets.size).toBe(2);
    await expect(player.getByRole("radio", { name: "Trà", exact: true })).toBeVisible();
    let hostReads = 0; host.on("request", (request) => { if (request.url().endsWith(`/api/apps/${id}/state`)) hostReads++; });
    // Longer than the old 1.5s interval: healthy channels must remain idle.
    await new Promise((resolve) => setTimeout(resolve, 3200)); expect(hostReads).toBe(0);
    await player.getByRole("radio", { name: "Trà", exact: true }).check();
    await player.getByRole("button", { name: "Gửi câu trả lời", exact: true }).click();
    await expect(player.getByText("Đã gửi câu trả lời.", { exact: true })).toBeVisible(); notify();
    await expect(host.getByTestId("participant-count")).toHaveText("1 người tham gia");
    await host.getByRole("button", { name: "Đóng bình chọn", exact: true }).click(); notify();
    await expect(player.getByRole("button", { name: "Gửi câu trả lời", exact: true })).toBeDisabled();
    expect(hostReads).toBeGreaterThan(0);
  } finally { for (const context of contexts) await context.close(); }
});
