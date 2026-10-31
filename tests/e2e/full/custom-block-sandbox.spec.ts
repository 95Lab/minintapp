// Sandboxed custom block, end to end: the host opens the tap-race template, a phone plays inside the
// iframe and its score reaches the host; the page itself cannot reach the network or the host page.
import { expect, test } from "@playwright/test";
import { hostFromTemplate, openPhone } from "./core-loop-helpers";

test("tap game: phone plays in the sandbox, host sees the submission, page has no network", async ({ page, browser }) => {
  test.setTimeout(90_000);
  const { host, appUrl } = await hostFromTemplate(page, "Thi bấm nhanh 10 giây");
  const phone = await openPhone(browser, appUrl, "An");

  const iframe = phone.locator("iframe[sandbox]");
  await expect(iframe).toHaveCount(1);
  // least privilege: scripts only, never same-origin / forms / popups / top navigation
  await expect(iframe).toHaveAttribute("sandbox", "allow-scripts");

  const game = phone.frameLocator("iframe[sandbox]");
  for (let i = 0; i < 5; i++) await game.locator("#tap").click();
  await expect(game.locator("#score")).toHaveText("5");

  // The round ends after 10 s and submits the score; the phone's own leaderboard then shows it.
  await expect(game.locator("#board li").first()).toContainText("An - 5", { timeout: 25_000 });
  await expect(host.getByText("1 lượt gửi").first()).toBeVisible({ timeout: 15_000 });
  // the host's copy of the page shows the same board and has no tap button
  await expect(host.frameLocator("iframe[sandbox]").locator("#board li").first()).toContainText("An - 5");
  await expect(host.frameLocator("iframe[sandbox]").locator("#tap")).toBeHidden();

  // Inside the iframe the network is closed (CSP connect-src 'none') and the host page is out of reach.
  const frame = phone.frames().find((f) => f.url().includes("/sandbox/"));
  expect(frame).toBeTruthy();
  const outcome = await frame!.evaluate(async () => {
    const net = await fetch("/api/engine/apps/anything/state").then(() => "reached", () => "blocked");
    let parentAccess = "reached";
    try {
      void window.parent.document.title;
    } catch {
      parentAccess = "blocked";
    }
    let storage = "reached";
    try {
      void window.localStorage.length;
    } catch {
      storage = "blocked";
    }
    return { net, parentAccess, storage };
  });
  expect(outcome).toEqual({ net: "blocked", parentAccess: "blocked", storage: "blocked" });
});

test("the sandbox page cannot be opened as a page of its own", async ({ page, browser }) => {
  test.setTimeout(60_000);
  const { appUrl } = await hostFromTemplate(page, "Thi bấm nhanh 10 giây");
  const phone = await openPhone(browser, appUrl, "An");
  await expect(phone.locator("iframe[sandbox]")).toHaveCount(1);
  const frameUrl = await phone.locator("iframe[sandbox]").getAttribute("src");
  expect(frameUrl).toMatch(/^\/sandbox\//);
  // a direct visit sends sec-fetch-dest: document, the frame sends iframe
  const direct = await phone.goto(frameUrl!);
  expect(direct?.status()).toBe(404);
  await expect(phone.locator("body")).toContainText("Not found");
  await expect(phone.locator("#tap")).toHaveCount(0);
});
