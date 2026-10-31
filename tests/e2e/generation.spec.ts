import { expect, test } from "@playwright/test";

test("generation UI opens a persisted app and host cookie from a mocked generation response", async ({ page, browser, baseURL }) => {
  // Mock only the generation endpoint. Existing app creation, host auth and voting stay real.
  let submitted: unknown;
  await page.route("**/api/engine/generate", async (route) => {
    submitted = route.request().postDataJSON();
    const created = await page.request.post(`${baseURL}/api/apps/from-template`, { data: { templateId: "poll-drinks", locale: "vi", lifetime: "24h" } });
    expect(created.status()).toBe(201);
    const app = await created.json();
    await page.request.post(`${baseURL}/api/engine/host-token`,{data:{id:app.id,token:app.hostToken}});
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ ...app, generation: { provider: "openai", model: "test-only", durationMs: 1 } }) });
  });
  await page.goto("/");
  await page.getByLabel("Bạn cần mini-app gì?").fill("Bình chọn đồ uống cho workshop");
  await page.getByRole("button", { name: "Tiếp tục làm rõ" }).click();
  await page.getByRole("button", { name: "Xem lại yêu cầu" }).click();
  await page.getByLabel("Thời gian sử dụng").selectOption("24h");
  await page.getByRole("button", { name: "Xác nhận và tạo ứng dụng", exact: true }).click();
  await expect(page).toHaveURL(/\/rooms\/[a-f0-9]{24}\/host$/);
  expect(submitted).toEqual({ prompt: "Bình chọn đồ uống cho workshop", lifetime: "24h" });
  await expect(page.getByRole("heading", { name: "Bình chọn", exact:true })).toBeVisible();
  const id = page.url().split("/").at(-2)!;
  const context = await browser.newContext();
  try {
    const player = await context.newPage();
    await player.goto(`${baseURL}/a/${id}`);
    await player.getByRole("radio", { name: "Trà", exact: true }).check();
    await player.getByRole("button", { name: "Gửi câu trả lời", exact: true }).click();
    await expect.poll(async()=>{const r=await page.request.get(`${baseURL}/api/engine/apps/${id}/state`,{headers:{"x-host-session":"1"}});return(await r.json()).participantCount;}).toBe(1);
  } finally { await context.close(); }
});

test("generation error keeps the prompt and re-enables submit", async ({ page }) => {
  let calls = 0;
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => { finish = resolve; });
  await page.route("**/api/engine/generate", async (route) => {
    calls++;
    await pending;
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ ok: false, code: "ai_not_configured", message: "OpenAI chưa được cấu hình." }) });
  });
  await page.goto("/");
  await page.getByLabel("Bạn cần mini-app gì?").fill("Một cuộc bình chọn");
  await page.getByRole("button", { name: "Tiếp tục làm rõ" }).click();
  await page.getByRole("button", { name: "Xem lại yêu cầu" }).click();
  await page.getByRole("button", { name: "Xác nhận và tạo ứng dụng", exact: true }).click();
  await expect(page.getByRole("button", { name: "Đang tạo…", exact: true })).toBeDisabled();
  await expect(page.getByText("Đang phân tích yêu cầu…", { exact: true })).toBeVisible();
  await expect.poll(() => calls).toBe(1);
  finish();
  await expect(page.getByRole("region", { name: "Tạo ứng dụng bằng OpenAI" }).getByRole("alert")).toHaveText("OpenAI chưa được cấu hình.");
  await expect(page.getByLabel("Yêu cầu sẽ gửi để tạo app")).toHaveValue("Một cuộc bình chọn");
  await expect(page.getByRole("button", { name: "Xác nhận và tạo ứng dụng", exact: true })).toBeEnabled();
});
