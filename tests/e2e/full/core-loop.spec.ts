// The core loop, end to end, through the real UI: host creates → phones join → answer → host sees it →
// host acts → remix moves everyone → app ends. Guards the seams unit tests can't reach: effects,
// click handlers, polling resync, follow-the-remix, gone screens.
import { expect, test } from "@playwright/test";
import { enterNameIfAsked, hostFromTemplate, openPhone, option } from "./core-loop-helpers";

test("poll → remix into a quiz about the winner → quiz round → end", async ({ page, browser }) => {
  const { host, appUrl } = await hostFromTemplate(page, "Vote chủ đề");
  const phoneA = await openPhone(browser, appUrl, "An");
  const phoneB = await openPhone(browser, appUrl, "Bình");

  // Tap-to-vote: no submit button, results appear only after voting.
  await expect(phoneA.locator(".bar-row")).toHaveCount(0);
  await option(phoneA, "Bảo mật").click();
  await expect(phoneA.getByText("Đã ghi nhận")).toBeVisible();
  await expect(phoneA.locator(".bar-row").first()).toBeVisible();
  await option(phoneB, "Bảo mật").click();
  await expect(host.getByText("2 lượt gửi")).toBeVisible();

  // Mock the AI-dependent remix response while exercising real creation, host cookies,
  // parent redirect and cross-device follow. The full remix pipeline is covered by route tests.
  await host.route("**/api/engine/apps/*/remix",async(route)=>{
    const created=await host.request.post("/api/engine/apps/from-template",{data:{templateId:"quick-quiz",locale:"vi",lifetime:"1h"}});
    const child=await created.json();expect(created.status()).toBe(201);
    const parentId=new URL(appUrl,host.url()).pathname.split("/").at(-1)!;
    const moved=await host.request.post(`/api/engine/apps/${parentId}/lifecycle`,{headers:{"x-host-session":"1"},data:{action:"redirect",toId:child.id,toHostToken:child.hostToken}});expect(moved.ok()).toBe(true);
    await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({ok:true,newId:child.id,hostToken:child.hostToken})});
  });
  // Remix from the host; both phones must follow to the child app on their own.
  await host.getByRole("button", { name: /Đổi thành quiz 3 câu về chủ đề vừa thắng/ }).click();
  await host.getByRole("button", { name: "Remix" }).click();
  await host.waitForURL((url) => url.pathname.endsWith("/host") && !appUrl.endsWith(url.pathname.replace("/host", "")));
  await expect(host.getByRole("heading", { level: 1 })).toContainText(/bảo mật|Bảo mật|mật khẩu/);
  const childPath = new URL(host.url()).pathname.replace(/\/host$/, "");
  for (const phone of [phoneA, phoneB]) {
    await phone.waitForURL((url) => url.pathname === childPath, { timeout: 15_000 });
    await enterNameIfAsked(phone, phone === phoneA ? "An" : "Bình");
  }

  // Quiz round driven by the host.
  await host.getByRole("button", { name: "Mở câu hỏi" }).first().click();
  const firstChoice = phoneA.locator(".opt").first();
  await expect(firstChoice).toBeVisible({ timeout: 10_000 });
  await firstChoice.click();
  await host.getByRole("button", { name: "Hiện đáp án" }).first().click();
  await expect(phoneA.getByText(/Chính xác!|Chưa đúng\./)).toBeVisible({ timeout: 10_000 });

  // End now: phones see the app is gone.
  await host.getByRole("button", { name: "Kết thúc ngay" }).click();
  await host.getByRole("button", { name: "Kết thúc và xoá" }).click();
  await expect(phoneB.getByText("App này đã kết thúc")).toBeVisible({ timeout: 15_000 });
});

test("expense log: add, edit, remove lines; a rejected line keeps what was typed", async ({ page, browser }) => {
  const { host, appUrl } = await hostFromTemplate(page, "Sổ chi tiêu nhóm");
  const phone = await openPhone(browser, appUrl, "Chi");
  const form = phone.locator(".compose-entries > form.compose-form");
  const amount = form.getByLabel(/Số tiền/);
  const what = form.getByLabel(/Cho việc gì/);

  await amount.fill("500.000");
  await what.fill("Khách sạn");
  await form.getByRole("button", { name: "Thêm" }).click();
  await expect(phone.locator(".compose-entry", { hasText: "Khách sạn" })).toBeVisible();
  await amount.fill("120k");
  await what.fill("Ăn tối");
  await form.getByRole("button", { name: "Thêm" }).click();
  await expect(phone.locator(".compose-entry", { hasText: "Ăn tối" })).toContainText("120.000đ");

  // A link is refused by the server: the form keeps the typed values and says so.
  await amount.fill("30000");
  await what.fill("xem www.evil.com");
  await form.getByRole("button", { name: "Thêm" }).click();
  await expect(phone.getByText("Chưa gửi được")).toBeVisible();
  await expect(what).toHaveValue("xem www.evil.com");
  await expect(amount).toHaveValue("30000");

  // Edit then remove a line.
  const dinner = phone.locator(".compose-entry", { hasText: "Ăn tối" });
  await dinner.getByRole("button", { name: "Sửa" }).click();
  const editForm = phone.locator(".compose-entry-list form");
  await editForm.getByLabel(/Số tiền/).fill("150000");
  await editForm.getByRole("button", { name: "Cập nhật" }).click();
  await expect(phone.locator(".compose-entry", { hasText: "Ăn tối" })).toContainText("150.000đ");
  await phone.locator(".compose-entry", { hasText: "Khách sạn" }).getByRole("button", { name: "Xoá" }).click();
  await expect(phone.locator(".compose-entry", { hasText: "Khách sạn" })).toHaveCount(0);

  // The host's split counts only what is left.
  await expect(host.locator(".total-band").first()).toContainText("150.000đ");
});

test("host-paced steps: phones see only the open question, results after it closes", async ({ page, browser }) => {
  const { host, appUrl } = await hostFromTemplate(page, "Hỏi nhanh từng câu");
  const phone = await openPhone(browser, appUrl, "Dũng");
  await expect(phone.getByText("Chờ host mở câu tiếp")).toBeVisible();

  await host.getByRole("button", { name: "Mở câu đầu" }).click();
  await expect(phone.getByText("Câu 1/2")).toBeVisible({ timeout: 10_000 });
  await option(phone, "Buổi sáng").click();
  await expect(phone.getByText("Kết quả hiện khi host đóng câu này.").first()).toBeVisible();

  await host.getByRole("button", { name: "Mở câu tiếp" }).click();
  await expect(phone.getByText("Câu 2/2")).toBeVisible({ timeout: 10_000 });
  await expect(phone.locator(".bar-row", { hasText: "Buổi sáng" })).toContainText("1");
});

test("random teams: phones check in by opening the app, the host deals teams", async ({ page, browser }) => {
  const { host, appUrl } = await hostFromTemplate(page, "Chia đội ngẫu nhiên");
  const phones = [await openPhone(browser, appUrl, "Lan"), await openPhone(browser, appUrl, "Minh"), await openPhone(browser, appUrl, "Hà")];
  await expect(host.locator(".toolbar").getByText("3 người đã tham gia")).toBeVisible({ timeout: 15_000 });
  await host.getByRole("button", { name: "Chia đội" }).click();
  for (const phone of phones) await expect(phone.getByText("Đội 1")).toBeVisible({ timeout: 10_000 });
  await expect(phones[0].locator(".compose-teams .chip")).toHaveCount(3);
});

test("Q&A board: phones post questions and like each other's; the most liked rises on every screen", async ({ page, browser }) => {
  const { host, appUrl } = await hostFromTemplate(page, "Hỏi đáp (Q&A)");
  const asker = await openPhone(browser, appUrl, "An");
  const fan = await openPhone(browser, appUrl, "Bình");

  const ask = async (phone: typeof asker, text: string) => {
    const form = phone.locator(".compose-entries > form.compose-form");
    await form.getByLabel(/Câu hỏi của bạn/).fill(text);
    await form.getByRole("button", { name: "Thêm" }).click();
  };
  await ask(asker, "Khi nào ra bản mobile?");
  await ask(fan, "Giá bao nhiêu?");

  // Bình likes An's question; it moves to the top for everyone and the host sees the count.
  const question = fan.locator(".compose-board li", { hasText: "Khi nào ra bản mobile?" });
  await question.getByRole("button", { name: "Thích" }).click();
  await expect(question.getByRole("button", { name: "Bỏ thích" })).toBeVisible();
  await expect(host.locator(".compose-board li").first()).toContainText("Khi nào ra bản mobile?", { timeout: 15_000 });
  await expect(host.locator(".compose-board li").first()).toContainText("♥ 1");
  // No like button on one's own question.
  await expect(asker.locator(".compose-board li", { hasText: "Khi nào ra bản mobile?" }).getByRole("button")).toHaveCount(0);
});

test("chat: two phones send messages; both see both, oldest first, and the composer is ready again", async ({ page, browser }) => {
  const { host, appUrl } = await hostFromTemplate(page, "Phòng chat");
  const an = await openPhone(browser, appUrl, "An");
  const binh = await openPhone(browser, appUrl, "Bình");

  const say = async (phone: typeof an, text: string) => {
    const field = phone.locator(".compose-entries > form.compose-form").getByLabel(/Tin nhắn/);
    await field.fill(text);
    await phone.getByRole("button", { name: "Gửi" }).click();
    // sent: the field is empty and focused for the next message
    await expect(field).toHaveValue("");
    await expect(field).toBeFocused();
  };
  await say(an, "Chào cả nhà");
  await expect(binh.locator(".chat-bubble").first()).toHaveText("Chào cả nhà", { timeout: 15_000 });
  await say(binh, "Chào An!");

  for (const screen of [an, binh, host]) {
    await expect(screen.locator(".chat-bubble")).toHaveText(["Chào cả nhà", "Chào An!"], { timeout: 15_000 });
  }
  // own messages are on the right, with the author's name
  await expect(an.locator(".chat-msg.mine .chat-bubble")).toHaveText("Chào cả nhà");
  await expect(an.locator(".chat-msg").nth(1)).toContainText("Bình");
  await expect(binh.locator(".chat-msg.mine .chat-bubble")).toHaveText("Chào An!");
});

test("tabs: a phone switches to the second tab and answers it; the host sees it on the same tab", async ({ page, browser }) => {
  const { host, appUrl } = await hostFromTemplate(page, "Ngày workshop (nhiều tab)");
  const phone = await openPhone(browser, appUrl, "An");

  // One block at a time: the first tab (poll) is shown, the Q&A form is not.
  await expect(phone.getByRole("tab")).toHaveCount(4);
  await expect(phone.getByRole("tab", { name: /Chủ đề chiều nay/ })).toHaveAttribute("aria-selected", "true");
  await expect(phone.getByLabel(/Câu hỏi của bạn/)).toHaveCount(0);

  await phone.getByRole("tab", { name: "Hỏi đáp" }).click();
  await expect(phone).toHaveURL(/#qna$/);
  const form = phone.locator(".compose-entries > form.compose-form");
  await form.getByLabel(/Câu hỏi của bạn/).fill("Có ghi hình không?");
  await form.getByRole("button", { name: "Thêm" }).click();
  await expect(phone.locator(".compose-board li")).toContainText("Có ghi hình không?");

  // The host opens the same tab (a shared #qna link works) and sees the question.
  await host.getByRole("tab", { name: "Hỏi đáp" }).click();
  await expect(host.locator(".compose-board li").first()).toContainText("Có ghi hình không?", { timeout: 15_000 });
});

test("ranked choice: a phone taps its top 3 in order and the host sees Borda points", async ({ page, browser }) => {
  const { host, appUrl } = await hostFromTemplate(page, "Xếp hạng ưu tiên");
  const phone = await openPhone(browser, appUrl, "Lan");
  for (const label of ["Xuất PDF", "Chế độ tối", "Thông báo"]) await option(phone, label).click();
  // a 4th pick is not possible once the top 3 are set
  await expect(option(phone, "Tìm kiếm nhanh")).toBeDisabled();
  await phone.getByRole("button", { name: "Gửi" }).click();
  const top = host.locator(".lb li").first();
  await expect(top).toContainText("Xuất PDF", { timeout: 15_000 });
  await expect(top).toContainText("3 điểm");
});

test("buzzer: the host opens a round, the first phone to buzz is on top", async ({ page, browser }) => {
  const { host, appUrl } = await hostFromTemplate(page, "Bấm chuông giành quyền");
  const fast = await openPhone(browser, appUrl, "Nhanh");
  const slow = await openPhone(browser, appUrl, "Chậm");
  await host.getByRole("button", { name: /Mở câu đầu|Câu tiếp/ }).click();
  await fast.getByRole("button", { name: "BẤM!" }).click();
  await expect(fast.getByRole("button", { name: "Đã bấm ✓" })).toBeVisible();
  await slow.getByRole("button", { name: "BẤM!" }).click();
  const order = host.locator(".lb li");
  await expect(order.first()).toContainText("Nhanh", { timeout: 15_000 });
  await expect(order.nth(1)).toContainText("Chậm");
});

test("photo contest: a phone uploads a photo; others see it only after the host approves", async ({ page, browser }) => {
  // a real 1×1 PNG: the phone decodes and re-encodes it to JPEG before uploading
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
  const { host, appUrl } = await hostFromTemplate(page, "Thi ảnh");
  const author = await openPhone(browser, appUrl, "An");
  const viewer = await openPhone(browser, appUrl, "Bình");

  const form = author.locator(".compose-entries > form.compose-form");
  await form.locator('input[type="file"]').setInputFiles({ name: "beach.png", mimeType: "image/png", buffer: png });
  await expect(form.getByText("Đã tải ảnh lên — bấm Gửi.")).toBeVisible();
  await form.getByRole("button", { name: "Thêm" }).click();

  // the author sees their own photo as pending; the other phone sees nothing yet
  await expect(author.locator(".compose-board li", { hasText: "Chờ host duyệt" })).toBeVisible({ timeout: 15_000 });
  await expect(viewer.locator(".board-photo")).toHaveCount(0);

  // on the host screen (the projector) the waiting photo is blurred until approved
  const waiting = host.locator(".compose-board li").first();
  await expect(waiting.locator(".board-photo.blurred")).toBeVisible({ timeout: 15_000 });
  await waiting.getByRole("button", { name: "Duyệt", exact: true }).click();
  await expect(host.locator(".board-photo.blurred")).toHaveCount(0);
  await expect(viewer.getByRole("img", { name: "Ảnh của An" })).toBeVisible({ timeout: 15_000 });
  // the image really loads through the signed URL
  await expect.poll(() => viewer.getByRole("img", { name: "Ảnh của An" }).evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
});

test("keep it: the host extends the app and downloads every answer as CSV", async ({ page, browser }) => {
  const { host, appUrl } = await hostFromTemplate(page, "Vote chủ đề");
  const phone = await openPhone(browser, appUrl, "Lan");
  await option(phone, "AI agent").click();
  await expect(host.getByText("1 lượt gửi")).toBeVisible({ timeout: 15_000 });

  await host.getByRole("combobox", { name: "Gia hạn…" }).selectOption("24h");
  await expect(host.getByText(/Tự huỷ sau 1d/)).toBeVisible();
  await expect(host.locator(".notice.warn[role=alert]")).toHaveCount(0);

  const [download] = await Promise.all([host.waitForEvent("download"), host.getByRole("button", { name: "Tải kết quả (CSV)" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^minintapp-.+\.csv$/);
  const csv = await (await download.createReadStream()).toArray();
  expect(Buffer.concat(csv).toString("utf8")).toContain("AI agent");
});
