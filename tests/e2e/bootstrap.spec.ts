import { expect, test } from "@playwright/test";
test("homepage and liveness work without integration credentials", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "MinintApp", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Kiểm tra trạng thái hệ thống" }).click();
  await expect(page).toHaveURL(/\/api\/health$/);
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(health.headers()["cache-control"]).toBe("no-store");
  expect(await health.json()).toEqual({ status: "ok", service: "minintapp", stage: "bootstrap" });
});
