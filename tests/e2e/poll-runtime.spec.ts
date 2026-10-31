import { expect, test, type APIRequestContext } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pollManifest } from "../support/poll-runtime-fixtures";

async function stop(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, "exit"); child.kill("SIGTERM");
  const timer = setTimeout(() => child.kill("SIGKILL"), 6000);
  try { await exited; } finally { clearTimeout(timer); }
}
async function boot(dir: string, port: number, request: APIRequestContext) {
  const origin = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["--conditions=react-server", ".runtime-build/runtime/poll/main.js"], {
    env: { NODE_ENV: "test", PORT: String(port), POLL_LOCAL_ORIGIN: origin, POLL_MANIFEST_FILE: join(dir, "manifest.json"), POLL_HOST_TOKEN_FILE: join(dir, "host-token"), POLL_DB_FILE: join(dir, "poll.sqlite") },
    stdio: "ignore",
  });
  try {
    await expect.poll(async () => {
      if (child.exitCode !== null) throw new Error("Runtime exited during startup");
      try { return (await request.get(`${origin}/health`, { timeout: 1000 })).status(); } catch { return 0; }
    }, { timeout: 10000 }).toBe(200);
    return { child, origin };
  } catch (error) { await stop(child); throw error; }
}

test("independent poll serves two participants, survives restart and enforces host controls", async ({ browser, request }, testInfo) => {
  const dir = await mkdtemp(join(tmpdir(), "minint-runtime-e2e-"));
  const hostToken = randomBytes(32).toString("hex");
  await writeFile(join(dir, "manifest.json"), JSON.stringify(pollManifest({ resultsVisibility: "after_close" })));
  await writeFile(join(dir, "host-token"), hostToken, { mode: 0o600 });
  let running = await boot(dir, 3219 + testInfo.workerIndex, request);
  const a = await browser.newContext(), b = await browser.newContext(), host = await browser.newContext();
  try {
    const first = await a.newPage(), second = await b.newPage(), admin = await host.newPage();
    await first.goto(running.origin); await second.goto(running.origin);
    await first.getByRole("radio", { name: "Trà", exact: true }).check();
    await first.getByRole("button", { name: "Gửi bình chọn", exact: true }).click();
    await expect(first.getByText("Đã lưu bình chọn. Bạn có thể đổi lựa chọn.", { exact: true })).toBeVisible();
    await second.getByRole("radio", { name: "Cà phê", exact: true }).check();
    await second.getByRole("button", { name: "Gửi bình chọn", exact: true }).click();
    await expect(second.getByText("Đã lưu bình chọn. Bạn có thể đổi lựa chọn.", { exact: true })).toBeVisible();
    expect((await (await a.request.get(`${running.origin}/api/state`)).json()).results).toBeNull();
    await first.getByRole("radio", { name: "Cà phê", exact: true }).check();
    await first.getByRole("button", { name: "Đổi bình chọn", exact: true }).click();
    await expect.poll(async () => (await (await a.request.get(`${running.origin}/api/state`)).json()).myOptionId).toBe("coffee");
    await stop(running.child); running = await boot(dir, 3219 + testInfo.workerIndex, request);
    await first.reload(); await expect(first.getByRole("radio", { name: "Cà phê", exact: true })).toBeChecked();
    await admin.goto(`${running.origin}/host`); await admin.getByLabel("Khóa quản lý").fill(hostToken);
    await admin.getByRole("button", { name: "Đăng nhập quản lý", exact: true }).click();
    await expect(admin.getByText("Cà phê: 2", { exact: true })).toBeVisible();
    await admin.getByRole("button", { name: "Đóng bình chọn", exact: true }).click();
    await expect(first.getByText("Cà phê: 2", { exact: true })).toBeVisible();
    await expect(first.getByRole("button", { name: "Đổi bình chọn", exact: true })).toBeDisabled();
    await admin.getByRole("button", { name: "Mở lại bình chọn", exact: true }).click();
    await expect(first.getByRole("button", { name: "Đổi bình chọn", exact: true })).toBeEnabled();
    await first.setViewportSize({ width: 390, height: 844 });
    expect(await first.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await first.screenshot({ path: testInfo.outputPath("poll-runtime-mobile.png"), fullPage: true });
    await admin.getByRole("button", { name: "Kết thúc và xóa phiếu", exact: true }).click();
    await admin.getByRole("button", { name: "Xác nhận kết thúc", exact: true }).click();
    await expect(first.getByText("Ứng dụng đã kết thúc.", { exact: true }).last()).toBeVisible();
    expect((await a.request.get(`${running.origin}/api/state`)).status()).toBe(410);
  } finally { await Promise.all([a.close(), b.close(), host.close()]); await stop(running.child); await rm(dir, { recursive: true, force: true }); }
});

test("standalone HTTP runtime rejects votes after TTL while keeping liveness available", async ({ request }, testInfo) => {
  const dir = await mkdtemp(join(tmpdir(), "minint-expiry-e2e-"));
  await writeFile(join(dir, "manifest.json"), JSON.stringify(pollManifest({ expiresAt: Date.now() + 2500 })));
  await writeFile(join(dir, "host-token"), randomBytes(32).toString("hex"), { mode: 0o600 });
  const running = await boot(dir, 3219 + testInfo.workerIndex, request);
  try {
    await request.get(`${running.origin}/api/state`);
    await expect.poll(async () => (await (await request.get(`${running.origin}/health`)).json()).expired, { timeout: 6000 }).toBe(true);
    const response = await request.post(`${running.origin}/api/votes`, { headers: { origin: running.origin }, data: { optionId: "tea" } });
    expect(response.status()).toBe(410);
    expect((await request.get(`${running.origin}/`)).status()).toBe(410);
    expect((await request.get(`${running.origin}/health`)).status()).toBe(200);
  } finally { await stop(running.child); await rm(dir, { recursive: true, force: true }); }
});
