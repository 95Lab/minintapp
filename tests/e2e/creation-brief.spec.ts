import { test, expect } from "@playwright/test";
import { mockReadyPlan } from "../support/planning";

test("chat clarifies context, revises the brief and only generates on explicit confirmation", async ({ page }, testInfo) => {
  const requests: Array<{ messages: Array<{ role: string; content: string }>; currentBrief: string | null }> = [];
  let creates = 0;
  let generated: unknown;
  const brief = "Bình chọn trà và cà phê cho workshop. Mỗi người chọn nhiều món. Ẩn kết quả đến khi host chốt.";
  await page.route("**/api/engine/plan", async route => {
    const input = route.request().postDataJSON(); requests.push(input);
    const first = requests.length === 1;
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({
      status: first ? "clarify" : "ready",
      message: first ? "Mỗi người chọn một hay nhiều đồ uống?" : "Đã cập nhật. Bạn xem bản yêu cầu rồi chốt nhé.",
      suggestions: first ? ["Chọn nhiều món"] : [], brief: first ? null : brief,
    }) });
  });
  await page.route("**/api/engine/generate", async route => {
    creates++; generated = route.request().postDataJSON();
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ ok: false, message: "Thử lại sau" }) });
  });
  await page.goto("/");
  await page.getByLabel("Bạn cần mini-app gì?").fill("Bình chọn trà và cà phê cho workshop");
  await page.getByRole("button", { name: "Trao đổi ý tưởng" }).click();
  const chat = page.getByRole("dialog");
  await expect(chat).toBeVisible();
  await expect(chat.getByText("Mỗi người chọn một hay nhiều đồ uống?", { exact: true })).toBeVisible();
  const confirm = chat.getByRole("button", { name: "Chốt yêu cầu và tạo app" });
  await expect(confirm).toBeDisabled();
  await chat.getByRole("button", { name: "Chọn nhiều món" }).click();
  await expect(confirm).toBeEnabled();
  expect(creates).toBe(0);
  await page.screenshot({ path: testInfo.outputPath("planning-chat-desktop.png") });
  await chat.getByLabel("Trao đổi thêm hoặc chỉnh yêu cầu").fill("Ẩn kết quả đến khi tôi chốt");
  await expect(confirm).toBeDisabled();
  await chat.getByRole("button", { name: "Gửi tin nhắn" }).click();
  await expect(confirm).toBeEnabled();
  expect(requests.at(-1)?.currentBrief).toBe(brief);
  expect(requests.at(-1)?.messages.at(-1)?.content).toBe("Ẩn kết quả đến khi tôi chốt");
  await chat.getByLabel("Trao đổi thêm hoặc chỉnh yêu cầu").fill("ok");
  await chat.getByRole("button", { name: "Gửi tin nhắn" }).click();
  await expect(confirm).toBeEnabled();
  expect(creates).toBe(0);
  await chat.getByLabel("Thời gian sử dụng").selectOption("24h");
  await confirm.click();
  await expect(chat.getByRole("alert")).toHaveText("Thử lại sau");
  expect(creates).toBe(1);
  expect(generated).toEqual({ prompt: brief, lifetime: "24h" });
  await expect(confirm).toBeEnabled();
  await expect(chat.getByRole("complementary", { name: "Bản yêu cầu" })).toContainText(brief);
});

test("chat errors can be retried; closing and reopening preserves the conversation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let turns = 0;
  await page.route("**/api/engine/plan", async route => {
    turns++;
    await route.fulfill(turns === 1 ? { status: 503, contentType: "application/json", body: JSON.stringify({ message: "AI tạm thời không khả dụng" }) } : { contentType: "application/json", body: JSON.stringify({ status: "unsupported", message: "Chưa hỗ trợ thanh toán. Bạn muốn ghi nhận chi tiêu không?", brief: null, suggestions: ["Dùng sổ chi tiêu"] }) });
  });
  await page.goto("/");
  await page.getByLabel("Bạn cần mini-app gì?").fill("App thanh toán");
  await page.getByRole("button", { name: "Trao đổi ý tưởng" }).click();
  const chat = page.getByRole("dialog");
  await expect(chat.getByRole("alert")).toHaveText("AI tạm thời không khả dụng");
  await expect(chat.getByLabel("Trao đổi thêm hoặc chỉnh yêu cầu")).toHaveValue("App thanh toán");
  await chat.getByRole("button", { name: "Gửi tin nhắn" }).click();
  await expect(chat.getByText("Chưa hỗ trợ thanh toán. Bạn muốn ghi nhận chi tiêu không?", { exact: true })).toBeVisible();
  await expect(chat.getByRole("button", { name: "Chốt yêu cầu và tạo app" })).toBeDisabled();
  expect(await chat.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(chat).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Trao đổi ý tưởng" })).toBeFocused();
  await page.getByRole("button", { name: "Trao đổi ý tưởng" }).click();
  await expect(chat.getByText("Chưa hỗ trợ thanh toán. Bạn muốn ghi nhận chi tiêu không?", { exact: true })).toBeVisible();
  expect(turns).toBe(2);
});

test("a pending revision locks confirmation and failure cannot reuse a stale ready brief", async ({ page }) => {
  await mockReadyPlan(page);
  await page.goto("/");
  await page.getByLabel("Bạn cần mini-app gì?").fill("Bình chọn đồ uống");
  await page.getByRole("button", { name: "Trao đổi ý tưởng" }).click();
  const chat = page.getByRole("dialog");
  const confirm = chat.getByRole("button", { name: "Chốt yêu cầu và tạo app" });
  await expect(confirm).toBeEnabled();
  let finish!: () => void;
  const pending = new Promise<void>(resolve => { finish = resolve; });
  await page.route("**/api/engine/plan", async route => {
    await pending;
    await route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ message: "Thử lại" }) });
  });
  await chat.getByLabel("Trao đổi thêm hoặc chỉnh yêu cầu").fill("Đổi thành quiz");
  await chat.getByRole("button", { name: "Gửi tin nhắn" }).click();
  await expect(confirm).toBeDisabled();
  finish();
  await expect(chat.getByRole("alert")).toHaveText("Thử lại");
  await chat.getByLabel("Trao đổi thêm hoặc chỉnh yêu cầu").fill("");
  await expect(confirm).toBeDisabled();
});

test("long planning conversations continue within API limits without losing the visible history", async ({ page }) => {
  const { PlanningRequestSchema } = await import("../../src/lib/api/planning-contract");
  const original = "Bình chọn đồ uống cho workshop";
  const brief = "Bình chọn trà và cà phê, ẩn kết quả đến khi host chốt.";
  let turns = 0;
  await page.route("**/api/engine/plan", async route => {
    const input = PlanningRequestSchema.parse(route.request().postDataJSON());
    expect(input.messages[0].content).toBe(original);
    if (turns > 0) expect(input.currentBrief).toBe(brief);
    turns++;
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({
      status: "ready", message: `Phản hồi ${turns}: ${"Chi tiết. ".repeat(100)}`,
      suggestions: [], brief,
    }) });
  });
  await page.goto("/");
  await page.getByLabel("Bạn cần mini-app gì?").fill(original);
  await page.getByRole("button", { name: "Trao đổi ý tưởng" }).click();
  const chat = page.getByRole("dialog");
  const confirm = chat.getByRole("button", { name: "Chốt yêu cầu và tạo app" });
  await expect(confirm).toBeEnabled();
  for (let turn = 1; turn <= 14; turn++) {
    await chat.getByLabel("Trao đổi thêm hoặc chỉnh yêu cầu").fill(`Điều chỉnh ${turn}`);
    await chat.getByRole("button", { name: "Gửi tin nhắn" }).click();
    await expect(confirm).toBeEnabled();
  }
  expect(turns).toBe(15);
  await expect(chat.getByRole("alert")).toHaveCount(0);
  await expect(chat.getByText(original, { exact: true })).toBeVisible();
  await expect(chat.getByText("Điều chỉnh 14", { exact: true })).toBeVisible();
});

test("template library links to planning and preserves selected lifetime with defaults", async ({ page }) => {
  const requests: unknown[] = [];
  let generated: unknown;
  await page.route("**/api/engine/plan", route => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ json: requests.length === 1
      ? { status: "clarify", message: "Bạn muốn bổ sung gì?", suggestions: [], brief: "Bình chọn đồ uống" }
      : { status: "ready", message: "Chốt yêu cầu và tạo app", suggestions: [], brief: "Bình chọn trà và cà phê, dùng mặc định" } });
  });
  await page.route("**/api/engine/generate", route => {
    generated = route.request().postDataJSON();
    return route.fulfill({ status: 503, json: { message: "Thử lại sau" } });
  });
  await page.goto("/templates");
  await page.getByRole("link", { name: "Tạo từ ý tưởng" }).click();
  await expect(page).toHaveURL(/\/#create$/);
  await page.getByLabel("Bạn cần mini-app gì?", { exact: true }).fill("Bình chọn trà và cà phê");
  await page.getByRole("button", { name: "Trao đổi ý tưởng" }).click();
  const chat = page.getByRole("dialog");
  await expect(chat.getByText("Bạn muốn bổ sung gì?")).toBeVisible();
  await chat.getByLabel("Thời gian sử dụng").selectOption("24h");
  await chat.getByRole("button", { name: "Dùng mặc định và chốt yêu cầu" }).click();
  await expect(chat.getByRole("button", { name: "Chốt yêu cầu và tạo app", exact: true })).toBeEnabled();
  expect(requests.at(-1)).toMatchObject({ lifetime: "24h", useDefaults: true });
  await chat.getByLabel("Thời gian sử dụng").selectOption("7d");
  await chat.getByRole("button", { name: "Đóng cửa sổ chat" }).click();
  await page.getByRole("button", { name: "Trao đổi ý tưởng" }).click();
  await expect(chat.getByLabel("Thời gian sử dụng")).toHaveValue("7d");
  await chat.getByRole("button", { name: "Chốt yêu cầu và tạo app", exact: true }).click();
  await expect(chat.getByRole("alert")).toContainText("Thử lại sau");
  expect(generated).toEqual({ prompt: "Bình chọn trà và cà phê, dùng mặc định", lifetime: "7d" });
});
