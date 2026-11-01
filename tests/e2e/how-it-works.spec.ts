import { expect, test } from "@playwright/test";

test("how-it-works anchor opens the interactive guide and its real destinations", async ({ page }, testInfo) => {
  await page.goto("/#how-it-works");
  const guide = page.locator("#how-it-works");
  await expect(guide.getByRole("heading", { name: "Một ý tưởng nhỏ. Ba bước để bắt đầu." })).toBeInViewport();
  await expect(guide.getByRole("button", { name: /Nói điều bạn cần/ })).toHaveAttribute("aria-pressed", "true");
  await expect(guide.getByText("Tạo bình chọn đồ uống cho buổi workshop của nhóm.", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("how-overview.png"), fullPage: false });
  await guide.getByRole("button", { name: /Gửi link, mời cả nhóm/ }).click();
  await expect(guide.getByRole("heading", { name: "Một link. Mọi người cùng vào." })).toBeVisible();
  await guide.getByRole("button", { name: "Xem bước tiếp theo", exact: true }).click();
  await expect(guide.getByRole("heading", { name: "Hôm nay uống gì?" })).toBeVisible();
  await expect(guide.getByText("Số liệu chỉ để minh họa")).toBeVisible();
  await guide.screenshot({ path: testInfo.outputPath("how-desktop.png") });
  await guide.getByRole("button", { name: "Xem lại từ đầu", exact: true }).click();
  await expect(guide.getByRole("button", { name: /Nói điều bạn cần/ })).toHaveAttribute("aria-pressed", "true");
  await page.setViewportSize({ width: 390, height: 844 });
  await guide.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await guide.screenshot({ path: testInfo.outputPath("how-mobile.png") });
  await guide.getByRole("link", { name: "Tạo ứng dụng của bạn", exact: true }).click();
  await expect(page).toHaveURL(/#create$/);
  await expect(page.getByLabel("Bạn cần mini-app gì?")).toBeInViewport();
});

test("how-it-works supports English, keyboard buttons and reduced motion", async ({ page, context }) => {
  await context.addCookies([{ name: "minint-locale", value: "en", url: "http://127.0.0.1:3100" }]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#how-it-works");
  const guide = page.locator("#how-it-works");
  const share = guide.getByRole("button", { name: /Share a link, invite everyone/ });
  await share.focus(); await page.keyboard.press("Enter");
  await expect(share).toHaveAttribute("aria-pressed", "true");
  await expect(guide.getByRole("heading", { name: "One link. Everyone can join." })).toBeVisible();
  await expect(guide.getByRole("link", { name: "Or explore ready-made templates", exact: true })).toHaveAttribute("href", "/templates");
});

test("how it works includes Live Demo and redirects old preview links",async({page})=>{
 await page.goto("/preview");await expect(page).toHaveURL(/\/how-it-works#live-demo$/);
 await expect(page.getByRole("heading",{name:"Thử một app ngay tại đây",exact:true})).toBeVisible();
 await expect(page.getByRole("banner").locator('a[href="/preview"]')).toHaveCount(0);
 await page.getByRole("link",{name:"Tạo ứng dụng của bạn",exact:true}).first().click();
 await expect(page).toHaveURL(/\/#create$/);
});

for(const path of ["/","/how-it-works"])test(`guide actions have readable colors and mobile layout on ${path}`,async({page},testInfo)=>{
 await page.setViewportSize({width:320,height:844});await page.goto(path);
 const guide=path==="/"?page.locator("#how-it-works"):page.locator("main");const create=guide.getByRole("link",{name:"Tạo ứng dụng của bạn",exact:true}).first();
 const colors=await create.evaluate(el=>({background:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color}));
 expect(colors.background).toBe("rgb(185, 78, 48)");expect(colors.color).toBe("rgb(255, 255, 255)");
 const demo=guide.getByRole("link",{name:"Live Demo",exact:true});await expect(demo).toHaveAttribute("href",path==="/"?"/how-it-works#live-demo":"#live-demo");
 expect((await demo.boundingBox())?.height).toBeGreaterThanOrEqual(44);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await guide.screenshot({path:testInfo.outputPath("guide-mobile.png")});
});
