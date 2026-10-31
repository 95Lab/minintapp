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
