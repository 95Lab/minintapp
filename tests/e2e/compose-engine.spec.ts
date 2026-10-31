import { expect, test } from "@playwright/test";

test("multi-field survey validates conditions and publishes aggregates", async ({ page, browser, baseURL }) => {
  await page.goto("/"); await page.getByRole("button", { name: "Tạo khảo sát nhiều trường", exact: true }).click();
  await expect(page).toHaveURL(/\/host$/); const id = page.url().split("/").at(-2)!;
  const context = await browser.newContext();
  try {
    const player = await context.newPage(); await player.goto(`${baseURL}/a/${id}`);
    await player.getByLabel("Tên hiển thị").fill("Lan"); await player.getByRole("button", { name: "Tham gia ứng dụng", exact: true }).click();
    await expect(player.getByLabel("Chi tiết về công nghệ")).toHaveCount(0);
    await player.getByRole("checkbox", { name: "Công nghệ", exact: true }).check();
    await player.getByRole("checkbox", { name: "Thiết kế", exact: true }).check();
    await player.getByLabel("Chi tiết về công nghệ").fill("Rất hữu ích");
    await player.getByLabel("Đánh giá").fill("4"); await player.getByLabel("Ngày tham dự").fill("2026-10-31");
    await player.getByRole("button", { name: "Gửi câu trả lời", exact: true }).click();
    await expect(player.getByText("Đã gửi câu trả lời.", { exact: true })).toBeVisible();
    await expect(page.getByRole("row", { name: /Lan Công nghệ, Thiết kế Rất hữu ích 4 2026-10-31/ })).toBeVisible();
    await expect(player.getByRole("heading", { name: "Các câu trả lời", exact: true })).toHaveCount(0);
    await expect(player.locator("output")).toHaveText("4");
  } finally { await context.close(); }
});

test("many entries can be added, edited and deleted with live query totals", async ({ page, browser, baseURL }) => {
  await page.goto("/"); await page.getByRole("button", { name: "Tạo sổ chi tiêu", exact: true }).click();
  await expect(page).toHaveURL(/\/host$/); const id = page.url().split("/").at(-2)!;
  const context = await browser.newContext();
  try {
    const player = await context.newPage(); await player.goto(`${baseURL}/a/${id}`);
    await player.getByLabel("Tên hiển thị").fill("Lan"); await player.getByRole("button", { name: "Tham gia ứng dụng", exact: true }).click();
    for (const [note, amount] of [["Ăn trưa", "20"], ["Cà phê", "10"]]) {
      await player.getByLabel("Nội dung").fill(note); await player.getByLabel("Số tiền").fill(amount);
      await player.getByRole("button", { name: "Gửi câu trả lời", exact: true }).click();
      await expect(player.getByLabel("Nội dung")).toHaveValue("");
    }
    await expect(page.getByRole("row", { name: "Lan 30 2 100", exact: true })).toBeVisible();
    await player.getByRole("button", { name: "Sửa bản ghi 1", exact: true }).click();
    await expect(player.getByLabel("Nội dung")).toHaveValue("Ăn trưa"); await player.getByLabel("Số tiền").fill("40");
    await player.getByRole("button", { name: "Gửi câu trả lời", exact: true }).click();
    await expect(page.getByRole("row", { name: "Lan 50 2 100", exact: true })).toBeVisible();
    await player.getByRole("button", { name: "Xóa bản ghi 2", exact: true }).click();
    await expect(page.getByRole("row", { name: "Lan 40 1 100", exact: true })).toBeVisible();
    await player.reload(); await expect(player.getByRole("heading", { name: "Bản ghi của bạn (1/50)", exact: true })).toBeVisible();
  } finally { await context.close(); }
});

test("host opens and closes steps while participant results remain hidden until close", async ({ page, browser, baseURL }) => {
  await page.goto("/"); await page.getByRole("button", { name: "Tạo khảo sát từng bước", exact: true }).click();
  await expect(page).toHaveURL(/\/host$/); const id = page.url().split("/").at(-2)!;
  const context = await browser.newContext();
  try {
    const player = await context.newPage(); await player.goto(`${baseURL}/a/${id}`);
    await player.getByLabel("Tên hiển thị").fill("Lan"); await player.getByRole("button", { name: "Tham gia ứng dụng", exact: true }).click();
    await expect(player.getByText("Chờ host mở bước tiếp theo.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Mở bước tiếp theo", exact: true }).click();
    await player.getByLabel("Nội dung").fill("4"); await player.getByRole("button", { name: "Gửi câu trả lời", exact: true }).click();
    await expect(player.getByText("Đã gửi câu trả lời.", { exact: true })).toBeVisible();
    await expect(player.getByRole("heading", { name: "Điểm nội dung", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Mở bước tiếp theo", exact: true }).click();
    await expect(player.getByRole("heading", { name: "Điểm nội dung", exact: true })).toBeVisible();
    await player.getByLabel("Cách trình bày").fill("5"); await player.getByRole("button", { name: "Gửi câu trả lời", exact: true }).click();
    await expect(player.getByText("Đã gửi câu trả lời.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Đóng bước hiện tại", exact: true }).click();
    await expect(player.getByText("Đã hoàn thành các bước.", { exact: true })).toBeVisible();
    await expect(player.locator("output")).toHaveText(["4", "5"]);
    await page.getByRole("button", { name: "Bắt đầu lại các bước", exact: true }).click();
    await expect(player.locator("output")).toHaveCount(0);
  } finally { await context.close(); }
});
