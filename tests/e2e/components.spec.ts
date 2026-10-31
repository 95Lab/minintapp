import { expect, test } from "@playwright/test";

test("preview submits local answers, supports keyboard tabs and creates QR", async ({ page }) => {
  await page.goto("/preview");
  await expect(page.getByRole("heading", { name: "Thư viện component" })).toBeVisible();
  await page.getByRole("radio", { name: "Trà", exact: true }).check();
  await page.getByRole("button", { name: "Gửi câu trả lời", exact: true }).click();
  await expect(page.getByText("Đã gửi câu trả lời.", { exact: true })).toBeVisible();
  const pollTab = page.getByRole("tab", { name: "Chọn đồ uống" });
  await pollTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Quiz", exact: true })).toBeFocused();
  await expect(page.getByRole("heading", { name: "Một cộng một bằng?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Hai", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /✓/ })).toHaveCount(0);
  await pollTab.click();
  await expect(page.getByRole("radio", { name: "Trà", exact: true })).toBeChecked();
  await expect(page.getByRole("img", { name: "Mã QR mở ứng dụng" })).toBeVisible();
  await page.getByLabel("Chế độ xem").selectOption("host");
  await expect(page.getByRole("button", { name: "Mở câu hỏi" })).toBeDisabled();
});

test("unconnected features stay disabled and mobile preview fits the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/preview");
  await page.getByLabel("Bạn cần mini-app gì?").fill("Một cuộc bình chọn");
  await expect(page.getByRole("button", { name: "Trao đổi ý tưởng", exact: true })).toBeDisabled();
  await page.getByText("Tài khoản, remix và lifecycle", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Gửi liên kết đăng nhập" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Remix", exact: true })).toBeDisabled();
  await page.getByText("Các điểm mở rộng chưa khả dụng", { exact: true }).click();
  await expect(page.getByText("Thanh toán chưa khả dụng.", { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/components-mobile.png", fullPage: true });
});

test("preview shares home branding and translates its demo at 320px",async({page})=>{
 await page.setViewportSize({width:320,height:844});await page.goto("/preview");
 await expect(page.getByRole("banner").getByRole("link",{name:"MinintApp, trang chủ"})).toBeVisible();
 await expect(page.getByText("BẢN MINH HỌA",{exact:true})).toBeVisible();
 const header=page.getByRole("banner");await header.getByRole("button",{name:"Mở menu",exact:true}).click();await header.getByRole("button",{name:"EN",exact:true}).click();
 await expect(page.getByRole("heading",{name:"Component library",exact:true})).toBeVisible();
 await expect(page.getByRole("radio",{name:"Tea",exact:true})).toBeVisible();
 await page.getByText("Account, remix and lifecycle",{exact:true}).click();
 await expect(page.getByRole("button",{name:"Send sign-in link"})).toBeDisabled();
 await expect(page.getByRole("heading",{name:"Remix app",exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
