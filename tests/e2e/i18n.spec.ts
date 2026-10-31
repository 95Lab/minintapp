import { test, expect } from "@playwright/test";

test("language preference survives navigation and reload with server-rendered English", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "vi");
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.getByRole("heading", { name: "What do you need today?" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Explore all templates" })).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page).toHaveTitle(/Small apps/);
  await page.getByRole("link", { name: "Explore all templates" }).click();
  await expect(page.getByRole("button", { name: "EN", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "My apps" })).toBeVisible();
  await page.getByRole("button", { name: "VI", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ứng dụng của tôi" })).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Hôm nay bạn cần gì?" })).toBeVisible();
});

test("invalid locale cookies fall back to Vietnamese", async ({ context, page }) => {
  await context.addCookies([{ name: "minint-locale", value: "fr", domain: "127.0.0.1", path: "/" }]);
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "vi");
  await expect(page.getByRole("button", { name: "VI", exact: true })).toHaveAttribute("aria-pressed", "true");
});
