import { test, expect } from "@playwright/test";

test("language preference survives navigation and reload with server-rendered English", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "vi");
  await page.locator(".locale-switcher select").selectOption("en");
  await expect(page.getByRole("heading", { name: "What do you need today?" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Explore all templates" })).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page).toHaveTitle(/Small apps/);
  await page.getByRole("link", { name: "Explore all templates" }).click();
  await expect(page.locator(".locale-switcher select")).toHaveValue("en");
  await page.route("**/api/engine/auth/session", route => route.fulfill({json:{user:{email:"host@example.test"},accountsEnabled:true}}));
  await page.route("**/api/my-apps", route => route.fulfill({json:{apps:[]}}));
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "My apps" })).toBeVisible();
  await page.locator(".locale-switcher select").selectOption("vi");
  await expect(page.getByRole("heading", { name: "Ứng dụng của tôi" })).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Hôm nay bạn cần gì?" })).toBeVisible();
});

test("invalid locale cookies fall back to Vietnamese", async ({ context, page }) => {
  await context.addCookies([{ name: "minint-locale", value: "fr", domain: "127.0.0.1", path: "/" }]);
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "vi");
  await expect(page.locator(".locale-switcher select")).toHaveValue("vi");
});

test("English mini-app keeps its language for participants with Vietnamese preferences", async ({ page, browser, baseURL }) => {
  await page.goto("/");
  await page.locator(".locale-switcher select").selectOption("en");
  await page.getByRole("button", { name: "Create a sample poll", exact: true }).click();
  await expect(page).toHaveURL(/\/a\/[a-f0-9]{24}\/host$/);
  await expect(page.getByRole("heading", { name: "Share the app" })).toBeVisible();
  const id = page.url().split("/").at(-2)!;
  await page.locator(".locale-switcher select").selectOption("vi");
  await expect(page.getByRole("button", { name: "Close voting", exact: true })).toBeVisible();
  const participantContext = await browser.newContext();
  try {
    const participant = await participantContext.newPage();
    await participant.goto(`${baseURL}/a/${id}`);
    await expect(participant.getByRole("button", { name: "Submit response", exact: true })).toBeVisible();
    await participant.getByRole("radio").first().check();
    await participant.getByRole("button", { name: "Submit response", exact: true }).click();
    await expect(participant.getByText("Response submitted.", { exact: true })).toBeVisible();
    await expect(page.getByTestId("participant-count")).toHaveText("1 participant");
    await page.getByRole("button", { name: "Close voting", exact: true }).click();
    await expect(participant.getByRole("button", { name: "Submit response", exact: true })).toBeDisabled();
    await expect(participant.getByText("This app is not accepting responses.", { exact: true })).toBeVisible();
  } finally {
    await participantContext.close();
  }
});

test("English unavailable screen uses the interface preference", async ({ page }) => {
  await page.goto("/");
  await page.locator(".locale-switcher select").selectOption("en");
  await page.goto("/a/000000000000000000000000");
  await expect(page.getByRole("heading", { name: "This app is no longer active" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to home" })).toBeVisible();
});
