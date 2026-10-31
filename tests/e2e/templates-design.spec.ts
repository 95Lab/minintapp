import {expect,test} from "@playwright/test";
for(const width of [320,1280])test(`template library works at ${width}px`,async({page},testInfo)=>{
 await page.setViewportSize({width,height:900});
 await page.goto("/templates");
 await expect(page.getByRole("heading",{name:"Có sẵn mẫu. Chọn là chạy."})).toBeVisible();
 const lifetime=page.getByRole("combobox",{name:"Thời gian sử dụng"});await lifetime.selectOption("7d");
 const cards=page.locator("main .template-card");expect(await cards.count()).toBeGreaterThan(5);
 await page.route("**/api/engine/apps/from-template",async route=>{await route.fulfill({status:503,json:{code:"network"}});});
 const request=page.waitForRequest(r=>r.method()==="POST"&&r.url().includes("template"));
 await cards.first().click();const sent=await request;expect(sent.postDataJSON()).toMatchObject({lifetime:"7d",locale:"vi"});
 await expect(page.locator("main").getByRole("alert")).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:testInfo.outputPath(`templates-${width}.png`),fullPage:true});
});
test("dashboard redirects signed-out visitors and list API rejects guests",async({page,request})=>{
 await page.route("**/api/engine/auth/session",route=>route.fulfill({json:{user:null,accountsEnabled:true}}));
 let listed=false;await page.route("**/api/my-apps",route=>{listed=true;return route.fulfill({json:{apps:[]}});});
 await page.goto("/dashboard");await page.waitForURL("**/login");expect(listed).toBe(false);
 const response=await request.get("/api/my-apps");expect(response.status()).toBe(401);expect(await response.json()).toEqual({code:"sign_in_required"});
});
