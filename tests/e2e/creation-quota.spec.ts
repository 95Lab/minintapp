import { expect, test } from "@playwright/test";
import { errorText } from "../../src/engine/api/app-error-codes";

for (const [code, status] of [["owner_app_limit", 409], ["app_capacity_full", 503], ["creation_hourly_limit", 429]] as const) {
  test(`template creation explains ${code}`, async ({ page }) => {
    await page.route("**/api/engine/apps/from-template", route => route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ ok: false, code }) }));
    await page.goto("/templates");
    await page.locator(".template-grid").getByRole("button").first().click();
    await expect(page.getByRole("alert").filter({ hasText: errorText(code, "vi") })).toBeVisible();
    await expect(page.locator(".template-grid").getByRole("button").first()).toBeEnabled();
  });
}

test("full quota blocks AI before planning and recovers after freeing a slot", async ({ page }) => {
  let used = 50;
  let plans = 0;
  await page.route("**/api/creation-availability", route => route.fulfill({ json: { used, limit: 50 } }));
  await page.route("**/api/engine/plan", route => { plans++; return route.fulfill({ json: { status: "ready", message: "Sẵn sàng", suggestions: [], brief: "Bình chọn trà hoặc cà phê" } }); });
  await page.goto("/");
  await page.getByLabel("Bạn cần mini-app gì?").fill("Bình chọn trà hoặc cà phê");
  await expect(page.getByText("Đang dùng 50/50 chỗ ứng dụng.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Trao đổi ý tưởng" })).toBeDisabled();
  await expect(page.getByRole("link", { name: "Mở Ứng dụng của tôi" })).toHaveAttribute("href", "/dashboard");
  expect(plans).toBe(0);
  used = 49;
  await page.getByRole("button", { name: "Kiểm tra lại hạn mức" }).click();
  await page.getByRole("button", { name: "Trao đổi ý tưởng" }).click();
  await expect(page.getByRole("heading", { name: "Sẵn sàng để bạn chốt" })).toBeVisible();
  expect(plans).toBe(1);
});

test("an unavailable quota check preserves the idea and can be retried", async ({ page }) => {
  await page.route("**/api/creation-availability", route => route.fulfill({ status: 503, json: { message: "Unavailable" } }));
  await page.goto("/");
  await page.getByLabel("Bạn cần mini-app gì?").fill("Ý tưởng cần giữ");
  await page.getByRole("button", { name: "Trao đổi ý tưởng" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Bạn cần mini-app gì?")).toHaveValue("Ý tưởng cần giữ");
  await expect(page.getByRole("button", { name: "Kiểm tra lại hạn mức" })).toBeVisible();
});

test("quota changes during planning preserve the brief and offer a management link", async ({ page }) => {
  let used = 49;
  let creates = 0;
  await page.route("**/api/creation-availability", route => route.fulfill({ json: { used, limit: 50 } }));
  await page.route("**/api/engine/plan", route => route.fulfill({ json: { status: "ready", message: "Sẵn sàng", suggestions: [], brief: "Bình chọn trà hoặc cà phê" } }));
  await page.route("**/api/engine/generate", route => { creates++; return route.fulfill({ status: 503, json: {} }); });
  await page.goto("/");
  await page.getByLabel("Bạn cần mini-app gì?").fill("Bình chọn trà hoặc cà phê");
  await page.getByRole("button", { name: "Trao đổi ý tưởng" }).click();
  const chat = page.getByRole("dialog");
  await expect(chat.getByRole("button", { name: "Chốt yêu cầu và tạo app", exact: true })).toBeEnabled();
  used = 50;
  await chat.getByRole("button", { name: "Chốt yêu cầu và tạo app", exact: true }).click();
  await expect(chat.getByRole("link", { name: "Mở Ứng dụng của tôi" })).toHaveAttribute("href", "/dashboard");
  await expect(chat.getByRole("complementary")).toContainText("Bình chọn trà hoặc cà phê");
  expect(creates).toBe(0);
});

test("a failed template click shows its reason on screen, not below the long list", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.route("**/api/creation-availability", route => route.fulfill({ json: { used: 0, limit: 50 } }));
  await page.route("**/api/engine/apps/from-template", route => route.fulfill({ status: 503, json: { ok: false, code: "app_capacity_full" } }));
  await page.goto("/templates");
  await page.locator("button.template-card").first().click();
  await expect(page.getByRole("alert").filter({ hasText: "hết chỗ" })).toBeInViewport();
});
