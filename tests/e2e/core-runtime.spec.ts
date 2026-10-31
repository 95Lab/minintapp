import { expect, test } from "@playwright/test";

test("quiz host opens and reveals while participant answers stay private until reveal", async ({ page, browser, baseURL }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Tạo quiz mẫu", exact: true }).click();
  await expect(page).toHaveURL(/\/a\/[a-f0-9]{24}\/host$/);
  const id = page.url().split("/").at(-2)!;
  const context = await browser.newContext();
  try {
    const player = await context.newPage();
    await player.goto(`${baseURL}/a/${id}`);
    await player.getByLabel("Tên hiển thị").fill("Lan");
    await player.getByRole("button", { name: "Tham gia ứng dụng", exact: true }).click();
    const blocked = await context.request.post(`${baseURL}/api/apps/${id}/block-action`, { data: { blockId: "quiz-1", action: "reveal", args: { questionId: "q1" } } });
    expect(blocked.status()).toBe(403);
    await page.getByTestId("question-q1").getByRole("button", { name: "Mở câu hỏi", exact: true }).click();
    await player.getByRole("button", { name: "Hai", exact: true }).click();
    await expect(player.getByText("Đã gửi đáp án.", { exact: true })).toBeVisible();
    const hidden = await (await context.request.get(`${baseURL}/api/apps/${id}/state`)).json();
    expect(hidden.spec.blocks[0].questions.map((q: { correct: string | null }) => q.correct)).toEqual([null, null]);
    expect(hidden.results[0].countsByQuestion).toEqual({});
    expect(hidden.results[0].leaderboard).toEqual([{ name: "Lan", score: 0 }]);
    await page.getByTestId("question-q1").getByRole("button", { name: "Hiện đáp án", exact: true }).click();
    await expect(player.getByRole("button", { name: "Hai ✓", exact: true })).toBeDisabled();
    await expect(player.getByRole("row", { name: "Lan 100", exact: true })).toBeVisible();
    await page.getByTestId("question-q2").getByRole("button", { name: "Mở câu hỏi", exact: true }).click();
    await player.getByRole("button", { name: "Hà Nội", exact: true }).click();
    await expect(player.getByText("Đã gửi đáp án.", { exact: true })).toBeVisible();
    await page.getByTestId("question-q2").getByRole("button", { name: "Hiện đáp án", exact: true }).click();
    await expect(player.getByRole("row", { name: "Lan 200", exact: true })).toBeVisible();
    await player.reload();
    await expect(player.getByRole("button", { name: "Hà Nội ✓", exact: true })).toBeDisabled();
    await expect(player.getByLabel("Tên hiển thị")).toHaveCount(0);
  } finally { await context.close(); }
});

test("wheel uses a single server winner across devices, exhausts candidates and resets", async ({ page, browser, baseURL }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Tạo bốc thăm người tham gia", exact: true }).click();
  await expect(page).toHaveURL(/\/a\/[a-f0-9]{24}\/host$/);
  const id = page.url().split("/").at(-2)!;
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  try {
    const players = await Promise.all(contexts.map((context) => context.newPage()));
    for (let i = 0; i < players.length; i++) {
      await players[i].goto(`${baseURL}/a/${id}`);
      await players[i].getByLabel("Tên hiển thị").fill(i ? "Mai" : "Lan");
      await players[i].getByRole("button", { name: "Tham gia ứng dụng", exact: true }).click();
      await players[i].getByRole("button", { name: "Tham gia bốc thăm", exact: true }).click();
      await expect(players[i].getByText("Đã tham gia.", { exact: true })).toBeVisible();
    }
    await expect(page.getByText("2 lựa chọn còn lại", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Quay số", exact: true }).click();
    await expect(page.getByText("1 lựa chọn còn lại", { exact: true })).toBeVisible();
    const state = await (await contexts[0].request.get(`${baseURL}/api/apps/${id}/state`)).json();
    const winner = state.results[0].spins[0].label;
    expect(["Lan", "Mai"]).toContain(winner);
    for (const player of players) await expect(player.getByText(`Kết quả: ${winner}`, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Quay số", exact: true }).click();
    await expect(page.getByText("0 lựa chọn còn lại", { exact: true })).toBeVisible();
    const exhausted = await (await contexts[0].request.get(`${baseURL}/api/apps/${id}/state`)).json();
    expect(new Set(exhausted.results[0].spins.map((spin: { label: string }) => spin.label)).size).toBe(2);
    await page.getByRole("button", { name: "Quay số", exact: true }).click();
    await expect(page.getByText("Chưa có hoặc không còn người tham gia để quay.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Đặt lại vòng quay", exact: true }).click();
    await expect(page.getByText("2 lựa chọn còn lại", { exact: true })).toBeVisible();
    await expect(page.getByRole("list", { name: "Lịch sử bốc thăm" })).toHaveCount(0);
  } finally { await Promise.all(contexts.map((context) => context.close())); }
});
