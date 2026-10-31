import { expect, test } from "@playwright/test";

// Isolate fixture creation from the shared localhost create-rate budget of other suites.
const fixtureHeaders = { "x-forwarded-for": "192.0.2.80" };

test("participant remix follows the child runtime origin without carrying host credentials", async ({ page, request, baseURL }) => {
  const created = await request.post(`${baseURL}/api/engine/apps/from-template`, { headers: fixtureHeaders, data: { templateId: "quick-quiz", locale: "vi", lifetime: "1h" } });
  expect(created.status()).toBe(201);
  const parent = await created.json();
  const state = await (await request.get(`${baseURL}/api/engine/apps/${parent.id}/state`)).json();
  const childId = "b".repeat(24);
  const destination = `https://${childId}.apps.example.test/rooms/${childId}`;
  await page.route(destination, route => {
    expect(route.request().headers()["x-host-token"]).toBeUndefined();
    expect(route.request().headers().cookie ?? "").not.toContain(parent.hostToken);
    return route.fulfill({ contentType: "text/html", body: "<h1>Child runtime</h1>" });
  });
  await page.route(`**/api/engine/apps/${parent.id}/state`, route => route.fulfill({ json: { ...state, status: "closed", movedTo: childId, movedToUrl: destination } }));
  await page.goto(`/rooms/${parent.id}`);
  await expect(page).toHaveURL(destination);
  await expect(page.getByRole("heading", { name: "Child runtime" })).toBeVisible();
});

for (const templateId of ["quick-quiz", "tap-speed-game", "signup-slots"]) {
  test(`template ${templateId} waits for its independent deployment before opening the host`, async ({ page, baseURL }) => {
    const created = await page.request.post(`${baseURL}/api/engine/apps/from-template`, { headers: fixtureHeaders, data: { templateId, locale: "vi", lifetime: "1h" } });
    expect(created.status()).toBe(201);
    const app = await created.json();
    let polls = 0;
    await page.route("**/api/engine/apps/from-template", async route => {
      expect(route.request().postDataJSON().templateId).toBe(templateId);
      await route.fulfill({ status: 202, json: { ...app, deploymentState: "QUEUED" } });
    });
    await page.route(`**/api/apps/${app.id}/deployment`, route => route.fulfill({ json: { state: ++polls < 2 ? "DEPLOYING" : "RUNNING" } }));
    await page.goto("/templates");
    // Select by gallery order from the same immutable public template catalog.
    const { APP_TEMPLATES } = await import("../../src/engine/templates/app-templates");
    const index = APP_TEMPLATES.findIndex(template => template.id === templateId);
    await page.locator(".template-grid > button").nth(index).click();
    await expect.poll(() => polls).toBeGreaterThanOrEqual(1);
    await expect(page).toHaveURL(/\/templates$/);
    await expect(page).toHaveURL(new RegExp(`/rooms/${app.id}/host$`));
    expect(polls).toBeGreaterThanOrEqual(2);
    await expect(page.getByRole("button", { name: /Kết thúc|End/ }).first()).toBeVisible();
  });
}
