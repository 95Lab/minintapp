import { expect, test } from "@playwright/test";
test("homepage and liveness work without integration credentials", async ({ page, request }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Ý tưởng nhỏ. Kết nối cả nhóm.", exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("homepage-desktop.png"), fullPage: true });
  await page.getByRole("link", { name: "Kiểm tra trạng thái hệ thống" }).click();
  await expect(page).toHaveURL(/\/api\/health$/);
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(health.headers()["cache-control"]).toBe("no-store");
  expect(await health.json()).toEqual({ status: "ok", service: "minintapp", stage: "bootstrap" });
});

test("homepage keeps creation and template navigation usable on mobile", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByLabel("Bạn cần mini-app gì?")).toBeVisible();
  await expect(page.getByRole("button", { name: "Trao đổi ý tưởng", exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("homepage-mobile.png"), fullPage: true });
  await page.getByRole("button", { name: "Mở menu", exact: true }).click();
  await page.getByRole("link", { name: "Tạo ứng dụng", exact: true }).click();
  await expect(page).toHaveURL(/#create$/);
  await expect(page.getByRole("button", { name: "Tạo bình chọn mẫu", exact: true })).toBeAttached();
});
