// Host announcements, end to end: the host sends a line, an open phone shows it as a banner, dismissing
// hides it, and a newer announcement shows again.
import { expect, test } from "@playwright/test";
import { hostFromTemplate, openPhone } from "./core-loop-helpers";

test("announcement: host sends, phone shows banner, dismiss hides it, a newer one shows again", async ({ page, browser }) => {
  test.setTimeout(60_000);
  const { host, appUrl } = await hostFromTemplate(page, "Vote chủ đề");
  const phone = await openPhone(browser, appUrl, "An");
  const banner = phone.getByTestId("announcement-banner");
  await expect(banner).toHaveCount(0);

  const send = async (text: string) => {
    await host.getByLabel("Thông báo cho mọi người").fill(text);
    await host.getByRole("button", { name: "Gửi thông báo" }).click();
  };

  await send("Nghỉ giải lao 10 phút");
  await expect(banner).toContainText("Nghỉ giải lao 10 phút", { timeout: 10_000 });
  await expect(banner).toHaveAttribute("role", "status");
  // the host sees what was sent, and can take it back
  await expect(host.getByTestId("announcement-banner")).toContainText("Nghỉ giải lao 10 phút");
  await expect(host.getByRole("button", { name: "Gỡ" })).toBeVisible();

  await phone.getByRole("button", { name: "Ẩn thông báo" }).click();
  await expect(banner).toHaveCount(0);
  // still hidden after the next refresh of the same announcement
  await phone.waitForTimeout(2500);
  await expect(banner).toHaveCount(0);

  await send("Bắt đầu vote nhé");
  await expect(banner).toContainText("Bắt đầu vote nhé", { timeout: 10_000 });

  await host.getByRole("button", { name: "Gỡ" }).click();
  await expect(banner).toHaveCount(0, { timeout: 10_000 });
});
