import { expect, test } from "@playwright/test";
for (const width of [320,390,1280]) {
 test(`home keeps login and the original brand accessible at ${width}px`,async({page},info)=>{
  await page.setViewportSize({width,height:900});
  await page.route("**/api/engine/auth/session",route=>route.fulfill({json:{user:null,accountsEnabled:false}}));
  await page.goto("/");
  const header=page.getByRole("banner");
  await expect(header.getByRole("link",{name:"Đăng nhập",exact:true})).toBeInViewport();
  await expect(header.getByRole("link",{name:"MinintApp, trang chủ",exact:true})).toContainText("minintapp.");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath(`home-${width}-viewport.png`)});
  if(width<800){
   await header.getByRole("button",{name:"Mở menu",exact:true}).click();
   await expect(header.getByRole("link",{name:"Ứng dụng của tôi",exact:true})).toBeVisible();
   await header.getByRole("button",{name:"EN",exact:true}).click();
   await expect(header.getByRole("link",{name:"Sign in",exact:true})).toBeVisible();
   await header.getByRole("button",{name:"Close menu",exact:true}).press("Escape");
   await expect(header.getByRole("button",{name:"Open menu",exact:true})).toBeFocused();
  }
  await page.screenshot({path:info.outputPath(`home-${width}.png`),fullPage:true});
 });
}
test("signed-in home exposes account actions instead of a login link",async({page})=>{
 let signedIn=true;
 await page.route("**/api/engine/auth/session",route=>route.fulfill({json:{user:signedIn?{email:"host@example.test"}:null,accountsEnabled:true}}));
 await page.goto("/");
 await page.getByRole("banner").locator("summary").click();
 await expect(page.getByRole("banner").getByRole("link",{name:"App của tôi",exact:true})).toBeVisible();
 await expect(page.getByRole("banner").getByRole("button",{name:"Đăng xuất",exact:true})).toBeVisible();
 await expect(page.getByRole("banner").getByRole("link",{name:"Đăng nhập",exact:true})).toHaveCount(0);
 signedIn=false;await page.evaluate(()=>window.dispatchEvent(new Event("focus")));
 await expect(page.getByRole("banner").getByRole("link",{name:"Đăng nhập",exact:true})).toBeVisible();
});
