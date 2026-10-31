// Live data brick, end to end. The e2e server runs with LIVE_DATA=off, so the weather card shows the
// fixed sample, clearly labelled — no network involved. Host and phone see the same card.
import { expect, test } from "@playwright/test";
import { hostFromTemplate, openPhone } from "./core-loop-helpers";

test("weather template: host and phone both show the forecast card, labelled as sample data", async ({ page, browser }) => {
  const { host, appUrl } = await hostFromTemplate(page, "Đi Đà Lạt cuối tuần (thời tiết)");
  const phone = await openPhone(browser, appUrl, "An");

  for (const screen of [host, phone]) {
    await expect(screen.getByText("Đà Lạt").first()).toBeVisible();
    await expect(screen.getByText("Hiện tại")).toBeVisible();
    await expect(screen.getByText(/mưa \d+%/).first()).toBeVisible();
    await expect(screen.getByText("Dữ liệu mẫu")).toBeVisible();
    await expect(screen.getByText(/Cập nhật lúc \d{2}:\d{2}/)).toBeVisible();
    await expect(screen.getByText("Chưa lấy được dữ liệu, thử lại sau.")).toHaveCount(0);
  }
});

test("exchange-rate template: the converter computes both ways", async ({ page }) => {
  const { host } = await hostFromTemplate(page, "Tỷ giá đi Nhật");
  await expect(host.getByText("Dữ liệu mẫu")).toBeVisible();
  const jpy = host.getByLabel("JPY");
  const vnd = host.getByLabel("VND");
  await jpy.fill("2");
  await expect(vnd).toHaveValue("50000");
  await vnd.fill("125000");
  await expect(jpy).toHaveValue("5");
});
