import { test, expect } from "@playwright/test";

test("creation waits for a reviewed brief and preserves it after failure", async ({ page }) => {
  let calls = 0;
  let body: { prompt: string; lifetime: string } | undefined;
  await page.route("**/api/engine/generate", async route => {
    calls++;
    body = route.request().postDataJSON();
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ ok: false, message: "Thử lại sau" }) });
  });
  await page.goto("/");
  await page.getByLabel("Bạn cần mini-app gì?").fill("Bình chọn đồ uống");
  await page.getByRole("button", { name: "Tiếp tục làm rõ" }).click();
  await page.getByLabel("Ai sẽ dùng app, trong dịp nào?").fill("Nhóm workshop");
  await page.getByLabel("Mọi người cần nhập gì hoặc thực hiện thao tác nào?").fill("Chọn một đồ uống");
  await page.getByRole("button", { name: "Xem lại yêu cầu" }).click();
  const brief = page.getByLabel("Yêu cầu sẽ gửi để tạo app");
  await expect(brief).toHaveValue(/Nhóm workshop/);
  expect(calls).toBe(0);
  await brief.fill("Bình chọn trà hoặc cà phê cho workshop. Mỗi người một phiếu.");
  await page.getByLabel("Thời gian sử dụng", { exact: true }).selectOption("24h");
  await page.getByRole("button", { name: "Xác nhận và tạo ứng dụng" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  expect(calls).toBe(1);
  expect(body).toEqual({ prompt: "Bình chọn trà hoặc cà phê cho workshop. Mỗi người một phiếu.", lifetime: "24h" });
  await expect(brief).toHaveValue(body!.prompt);
  await brief.fill("a".repeat(501));
  await expect(page.getByRole("button", { name: "Xác nhận và tạo ứng dụng" })).toBeDisabled();
});
