import { expect, test } from "@playwright/test";

test("workspace dashboard filters deployment data and fits mobile", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/my-apps", (route) => route.fulfill({ json: { apps: [
    { id: "a".repeat(24), state: "RUNNING", hostname: "team.minintapp.io.vn", created_at: "2026-10-30T00:00:00Z", expires_at: "2026-11-06T00:00:00Z" },
    { id: "b".repeat(24), state: "SUSPENDED", hostname: "quiz.minintapp.io.vn", created_at: "2026-10-30T00:00:00Z", expires_at: "2026-11-06T00:00:00Z" },
  ] } }));
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Ứng dụng của tôi" })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(2);
  await page.getByRole("searchbox").fill("team");
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("region", { name: "Tổng quan ứng dụng" })).toContainText("02");
  await page.getByRole("searchbox").fill("");
  await page.getByRole("combobox", { name: "Trạng thái" }).selectOption("SUSPENDED");
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Chạy lại", exact: true })).toBeVisible();
  await page.getByRole("searchbox").fill("missing");
  await expect(page.getByRole("heading", { name: "Không tìm thấy ứng dụng" })).toBeVisible();
  await page.getByRole("button", { name: "Xóa bộ lọc" }).click();
  await expect(page.getByRole("article")).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("workspace-mobile.png"), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: testInfo.outputPath("workspace-desktop.png"), fullPage: true });
});

test("workspace dashboard offers a template for an empty session", async ({ page }) => {
  await page.route("**/api/my-apps", (route) => route.fulfill({ json: { apps: [] } }));
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Không gian cho ý tưởng đầu tiên" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Chọn mẫu để bắt đầu" })).toHaveAttribute("href", "/templates");
});
