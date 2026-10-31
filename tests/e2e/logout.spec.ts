import { expect, test } from "@playwright/test";
for (const width of [320,1280]) test(`logout is visible without opening a menu at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 let signedIn=true,deleted=false;
 await page.route("**/api/engine/auth/session",async route=>{
  if(route.request().method()==="DELETE"){deleted=true;signedIn=false;return route.fulfill({json:{ok:true}});}
  return route.fulfill({json:{accountsEnabled:true,user:signedIn?{email:"owner@example.test"}:null}});
 });
 await page.goto("/");
 const logout=page.getByRole("banner").getByRole("button",{name:"Đăng xuất",exact:true});
 await expect(logout).toBeInViewport();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await logout.click();
 await expect(page.getByRole("banner").getByRole("link",{name:"Đăng nhập",exact:true})).toBeVisible();
 expect(deleted).toBe(true);
});
test("failed logout keeps the session and offers retry",async({page})=>{
 await page.route("**/api/engine/auth/session",route=>route.fulfill(route.request().method()==="DELETE"?{status:503,json:{code:"unavailable"}}:{json:{accountsEnabled:true,user:{email:"owner@example.test"}}}));
 await page.goto("/");await page.getByRole("button",{name:"Đăng xuất",exact:true}).click();
 await expect(page.getByText("Chưa đăng xuất được. Vui lòng thử lại.")).toBeVisible();
 await expect(page.getByRole("button",{name:"Đăng xuất",exact:true})).toBeEnabled();
 await expect(page.getByRole("link",{name:"Đăng nhập",exact:true})).toHaveCount(0);
});
test("logout endpoint actually removes browser auth cookies",async({context,baseURL})=>{
 await context.addCookies([
  {name:"minint_session",value:"fixture-session",url:baseURL!,httpOnly:true},
  {name:"minint_pkce",value:"fixture-pending-state",url:baseURL!,httpOnly:true},
 ]);
 const response=await context.request.delete("/api/engine/auth/session",{headers:{Origin:baseURL!}});
 expect(response.status()).toBe(200);
 expect((await context.cookies()).some(cookie=>["minint_session","minint_pkce"].includes(cookie.name))).toBe(false);
});
