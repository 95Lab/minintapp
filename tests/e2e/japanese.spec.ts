import {expect,test} from "@playwright/test";
test("Japanese interface persists across home, templates, login and the guide",async({page})=>{
 await page.setViewportSize({width:320,height:844});await page.goto("/");
 const header=page.getByRole("banner");await header.getByRole("button",{name:"Mở menu",exact:true}).click();await header.getByRole("button",{name:"日本語",exact:true}).click();
 await expect(page.locator("html")).toHaveAttribute("lang","ja");
 await expect(page.getByRole("heading",{level:1})).toContainText("小さなアイデア。");
 await page.reload();await expect(page.locator("html")).toHaveAttribute("lang","ja");
 await expect(page).toHaveTitle(/小さなアプリ/);
 await page.goto("/templates");await expect(page.getByRole("heading",{level:1})).toContainText("テンプレート");
 await expect(page.getByRole("searchbox",{name:"アプリのテンプレートを検索"})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.goto("/login");await expect(page.getByRole("button",{name:"ログインリンクを送信"})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expect(page.getByRole("button",{name:"日本語",exact:true})).toHaveAttribute("aria-pressed","true");
 await page.goto("/how-it-works");await expect(page.getByRole("heading",{name:/小さなアイデアから/})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
