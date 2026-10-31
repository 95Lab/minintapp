import { expect, test } from "@playwright/test";

test("host and independent participants vote, change votes, reload and enforce lifecycle permissions", async ({ page, browser, baseURL }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Tạo bình chọn mẫu", exact: true }).click();
  await expect(page).toHaveURL(/\/a\/[a-f0-9]{24}\/host$/);
  const id = page.url().split("/").at(-2)!;
  await expect(page.getByRole("heading", { name: "Host · Bình chọn" })).toBeVisible();
  const firstContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const secondContext = await browser.newContext();
  try {
    const first = await firstContext.newPage();
    const second = await secondContext.newPage();
    await Promise.all([first.goto(`${baseURL}/a/${id}`), second.goto(`${baseURL}/a/${id}`)]);
    for (const participant of [first, second]) {
      await participant.getByRole("radio", { name: "Trà", exact: true }).check();
      await participant.getByRole("button", { name: "Gửi câu trả lời", exact: true }).click();
      await expect(participant.getByText("Đã gửi câu trả lời.", { exact: true })).toBeVisible();
    }
    await expect(page.getByTestId("participant-count")).toHaveText("2 người tham gia");
    await expect(page.getByText("Trà: 2", { exact: true })).toBeVisible();
    await first.getByRole("radio", { name: "Cà phê", exact: true }).check();
    await first.getByRole("button", { name: "Gửi câu trả lời", exact: true }).click();
    await expect(page.getByText("Trà: 1", { exact: true })).toBeVisible();
    await expect(page.getByText("Cà phê: 1", { exact: true })).toBeVisible();
    await expect(page.getByTestId("participant-count")).toHaveText("2 người tham gia");
    await first.reload();
    await expect(first.getByRole("radio", { name: "Cà phê", exact: true })).toBeChecked();
    expect(await first.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const forbidden = await firstContext.request.post(`${baseURL}/api/apps/${id}/lifecycle`, { data: { action: "close" } });
    expect(forbidden.status()).toBe(403);
    await page.getByRole("button", { name: "Đóng bình chọn", exact: true }).click();
    await expect(first.getByRole("button", { name: "Gửi câu trả lời", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "Mở lại bình chọn", exact: true }).click();
    await expect(first.getByRole("button", { name: "Gửi câu trả lời", exact: true })).toBeEnabled();
    await first.goto(`${baseURL}/a/${id}/host`);
    await expect(first.getByRole("heading", { name: "Không có quyền host" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Host · Bình chọn" })).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Kết thúc và xoá dữ liệu", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Ứng dụng không còn hoạt động" })).toBeVisible();
    const gone = await secondContext.request.get(`${baseURL}/api/apps/${id}/state`);
    expect(gone.status()).toBe(410);
  } finally { await firstContext.close(); await secondContext.close(); }
});
