import {expect,test} from "@playwright/test";
for(const width of [320,390,1280])test(`Japanese header is readable with clear language spacing at ${width}px`,async({page,context},info)=>{
 await context.addCookies([{name:"minint-locale",value:"ja",url:"http://127.0.0.1:3100"}]);
 await page.route("**/api/engine/auth/session",route=>route.fulfill({json:{user:null,accountsEnabled:true}}));
 await page.setViewportSize({width,height:900});await page.goto("/templates");
 const header=page.getByRole("banner");await expect(header.getByRole("link",{name:"ログイン",exact:true})).toBeInViewport();
 if(width<980)await header.getByRole("button",{name:"メニューを開く",exact:true}).click();
 await expect(header.getByRole("link",{name:"テンプレートを探す",exact:true})).toHaveAttribute("aria-current","page");
 const language=header.locator(".locale-switcher select");await expect(language).toBeVisible();await expect(language).toHaveValue("ja");await expect(language.locator("option")).toHaveCount(3);expect((await language.boundingBox())?.height).toBeGreaterThanOrEqual(44);
 const create=header.getByRole("link",{name:"アプリを作成",exact:true});await expect(create).toBeVisible();
 expect(await create.evaluate(el=>getComputedStyle(el).backgroundColor)).toBe("rgb(185, 78, 48)");
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await header.screenshot({path:info.outputPath(`japanese-header-${width}.png`)});
 if(width<980){await header.getByRole("button",{name:"メニューを閉じる",exact:true}).press("Escape");await expect(header.getByRole("button",{name:"メニューを開く",exact:true})).toHaveAttribute("aria-expanded","false");}
});
