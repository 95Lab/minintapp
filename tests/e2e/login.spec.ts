import { expect, test } from "@playwright/test";

test("login sends a magic link, shows confirmation and allows correcting the email", async ({ page }, testInfo) => {
  let submitted: unknown;
  await page.route("**/api/engine/auth/magic-link", async route => {
    submitted = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Một email là đủ." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Gửi link đăng nhập", exact: true })).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath("login-desktop.png"), fullPage: true });
  await page.getByLabel("Email của bạn").fill("person@example.com");
  await page.getByRole("button", { name: "Gửi link đăng nhập", exact: true }).click();
  expect(submitted).toEqual({ email: "person@example.com" });
  await expect(page.getByRole("heading", { name: "Kiểm tra email để đăng nhập" })).toBeFocused();
  await expect(page.getByText("person@example.com", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Đổi email hoặc gửi lại" }).click();
  await expect(page.getByLabel("Email của bạn")).toHaveValue("person@example.com");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole("button", { name: "Gửi link đăng nhập", exact: true })).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath("login-mobile.png"), fullPage: true });
});

test("login keeps email on failure and supports switching language", async ({ page }) => {
  await page.route("**/api/engine/auth/magic-link", route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ code: "network" }) }));
  await page.goto("/login");
  await page.getByLabel("Email của bạn").fill("person@example.com");
  await page.getByRole("button", { name: "Gửi link đăng nhập", exact: true }).click();
  await expect(page.locator("#login-error")).toBeVisible();
  await expect(page.locator("#login-error")).toHaveText("Mất kết nối. Thử lại nhé.");
  await expect(page.getByLabel("Email của bạn")).toHaveValue("person@example.com");
  await expect(page.getByRole("button", { name: "Gửi link đăng nhập", exact: true })).toBeEnabled();
  await page.locator(".locale-switcher select").selectOption("en");
  await expect(page.getByRole("heading", { name: "One email is all it takes." })).toBeVisible();
  await expect(page.getByLabel("Your email")).toHaveValue("person@example.com");
});
