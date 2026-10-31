// Settle-up and VietQR, end to end: two phones log expenses and see who pays whom; the host adds a bank
// account in the app; the debtor's phone then shows a QR with the bank details and the "only transfer if
// you know" warning, marks "I've transferred", and the host confirms receipt.
import { expect, test, type Page } from "@playwright/test";
import { hostFromTemplate, openPhone } from "./core-loop-helpers";

async function logExpense(phone: Page, amount: string, what: string) {
  const form = phone.locator(".compose-entries > form.compose-form");
  await form.getByLabel(/Số tiền/).fill(amount);
  await form.getByLabel(/Chi cho việc gì/).fill(what);
  await form.getByRole("button", { name: "Thêm" }).click();
  await expect(phone.locator(".compose-entry", { hasText: what })).toBeVisible();
}

test("settle up: expenses become a transfer; the host's payee gives the debtor a QR, paid / received marks follow", async ({ page, browser }) => {
  const { host, appUrl } = await hostFromTemplate(page, "Sổ chi tiêu chia tiền");
  const an = await openPhone(browser, appUrl, "An");
  const binh = await openPhone(browser, appUrl, "Bình");

  // An paid 300k, Bình paid 60k: each owes 180k, so Bình sends An 120k.
  await logExpense(an, "300000", "Khách sạn");
  await logExpense(binh, "60000", "Ăn tối");
  await expect(binh.getByTestId("settle-mine")).toContainText("Bạn cần chuyển 120.000đ cho An", { timeout: 15_000 });
  await expect(an.getByTestId("settle-mine")).toContainText("Bình cần chuyển cho bạn 120.000đ", { timeout: 15_000 });
  await expect(host.locator(".compose-transfers")).toContainText("Bình → An");

  // No account yet: no QR anywhere.
  await expect(binh.getByTestId("vietqr-image")).toHaveCount(0);

  // The host adds a bank account (bank from the fixed list; the name is stored in capitals without accents).
  const form = host.getByTestId("payee-form");
  await form.getByLabel("Ngân hàng").selectOption({ label: "Vietcombank" });
  await form.getByLabel("Số tài khoản").fill("0123456789");
  await form.getByLabel(/Tên chủ tài khoản/).fill("Nguyễn Văn An");
  await form.getByRole("button", { name: "Lưu tài khoản" }).click();
  await expect(form.getByRole("button", { name: "Gỡ tài khoản" })).toBeVisible();

  // The debtor's phone shows the QR with the details and the warning; the creditor's does not.
  await expect(binh.getByTestId("vietqr-image")).toBeVisible({ timeout: 15_000 });
  const qr = binh.getByTestId("settle-qr");
  await expect(qr).toContainText("Vietcombank");
  await expect(qr).toContainText("0123456789");
  await expect(qr).toContainText("NGUYEN VAN AN");
  await expect(qr).toContainText("120.000đ");
  await expect(binh.getByTestId("vietqr-warning")).toHaveText("Chỉ chuyển nếu bạn biết NGUYEN VAN AN.");
  await expect(binh.getByTestId("settle-mine")).toContainText("Bạn cần chuyển 120.000đ cho NGUYEN VAN AN");
  await expect(an.getByTestId("vietqr-image")).toHaveCount(0);
  await expect(an.getByTestId("settle-mine")).toContainText("Host sẽ chuyển lại cho bạn 120.000đ");

  // The host closes the expense log first: people settle up afterwards, so the marks must still work.
  await host.getByRole("button", { name: "Ngừng nhận" }).click();
  await expect(host.getByText("Đã ngừng nhận").first()).toBeVisible({ timeout: 15_000 });

  // Bình says "I've transferred"; the host sees it and marks it received; Bình sees that too, and the QR is gone.
  await binh.getByRole("button", { name: "Tôi đã chuyển" }).click({ timeout: 15_000 });
  await expect(host.locator(".settle-person", { hasText: "Bình" })).toContainText("✓ đã chuyển", { timeout: 15_000 });
  await host.locator(".settle-person", { hasText: "Bình" }).getByRole("button", { name: "Đã nhận 120.000đ" }).click();
  await expect(binh.locator(".settle-person", { hasText: "Bình" })).toContainText("✓✓ đã nhận 120.000đ", { timeout: 15_000 });
  await expect(binh.getByTestId("vietqr-image")).toHaveCount(0);
  await expect(binh.getByTestId("settle-mine")).toContainText("Bạn đã trả đủ phần của mình");
});

test("settle up: a bad account is refused with a message and nothing is shown", async ({ page, browser }) => {
  const { host, appUrl } = await hostFromTemplate(page, "Sổ chi tiêu chia tiền");
  const phone = await openPhone(browser, appUrl, "An");
  const form = host.getByTestId("payee-form");
  await form.getByLabel("Ngân hàng").selectOption({ label: "BIDV" });
  await form.getByLabel("Số tài khoản").fill("12345");
  await form.getByLabel(/Tên chủ tài khoản/).fill("Nguyễn Văn An");
  await form.getByRole("button", { name: "Lưu tài khoản" }).click();
  await expect(form.getByRole("alert")).toContainText("số tài khoản 6–19 chữ số");
  await expect(phone.getByTestId("vietqr-image")).toHaveCount(0);
});
