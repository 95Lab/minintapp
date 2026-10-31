// Place input + map view, end to end: a phone shares its (mocked) location, the host's map shows the dot.
// Geolocation and the OpenStreetMap tiles are mocked so the test runs offline.
import { expect, devices, test, type Page } from "@playwright/test";
import { enterNameIfAsked, hostFromTemplate } from "./core-loop-helpers";

// 1×1 transparent PNG
const PIXEL = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const stubTiles = (page: Page) => page.route("https://tile.openstreetmap.org/**", (route) => route.fulfill({ status: 200, contentType: "image/png", body: PIXEL }));

test("place: a phone shares its location; the host map shows one dot and the OSM attribution", async ({ page, browser }) => {
  await stubTiles(page);
  const { host, appUrl } = await hostFromTemplate(page, "Bạn đến từ đâu?");

  // Hà Nội, with more precision than the app may keep: it must be rounded on the device.
  const context = await browser.newContext({ ...devices["Pixel 7"], locale: "vi-VN", permissions: ["geolocation"], geolocation: { latitude: 21.02849, longitude: 105.85412 } });
  await context.route("https://tile.openstreetmap.org/**", (route) => route.fulfill({ status: 200, contentType: "image/png", body: PIXEL }));
  const phone = await context.newPage();
  await phone.goto(appUrl);
  await enterNameIfAsked(phone, "An");

  await phone.getByRole("button", { name: "Dùng vị trí của tôi" }).click();
  await expect(phone.getByTestId("place-dot")).toBeVisible();
  await expect(phone.getByRole("status").filter({ hasText: "21.028,105.854" })).toBeVisible();
  await phone.getByRole("button", { name: "Gửi" }).click();

  await expect(host.locator(".map-dot")).toHaveCount(1, { timeout: 15_000 });
  await expect(host.locator(".map-label")).toHaveText("An");
  await expect(host.getByRole("link", { name: /OpenStreetMap contributors/ })).toHaveAttribute("href", "https://www.openstreetmap.org/copyright");
  // the sender sees the same map with their own dot highlighted
  await expect(phone.locator(".compose-view .map-dot.mine")).toHaveCount(1, { timeout: 15_000 });
});

test("place: with location denied a phone can tap the map instead", async ({ page, browser }) => {
  await stubTiles(page);
  const { host, appUrl } = await hostFromTemplate(page, "Bạn đến từ đâu?");
  const context = await browser.newContext({ ...devices["Pixel 7"], locale: "vi-VN" });
  await context.route("https://tile.openstreetmap.org/**", (route) => route.fulfill({ status: 200, contentType: "image/png", body: PIXEL }));
  const phone = await context.newPage();
  await phone.goto(appUrl);
  await enterNameIfAsked(phone, "Bình");

  await phone.locator(".place-field [data-testid=map-box]").click();
  await expect(phone.getByTestId("place-dot")).toBeVisible();
  await phone.getByRole("button", { name: "Gửi" }).click();
  await expect(host.locator(".map-dot")).toHaveCount(1, { timeout: 15_000 });
});
