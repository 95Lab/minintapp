import {expect,test,type Page} from "@playwright/test";
const now=Date.now();
const app=(id:string,title:string,status="active",days=3)=>({id,title,status,locale:"vi",createdAt:new Date(now-86400000).toISOString(),expiresAt:new Date(now+days*86400000).toISOString(),maxExpiresAt:new Date(now+89*86400000).toISOString()});
async function setup(page:Page){
 let apps=[app("a".repeat(24),"Khảo sát đội ngũ"),app("b".repeat(24),"Quiz cuối tuần","closed",20),app("c".repeat(24),"Bình chọn món ăn")];
 const calls:Array<{id:string;action:string}>=[];
 await page.route("**/api/engine/auth/session",route=>route.fulfill({json:{user:{email:"host@example.test"},accountsEnabled:true}}));
 await page.route("**/api/engine/account",route=>route.fulfill({json:{ok:true,email:"host@example.test",apps}}));
 await page.route("**/api/engine/apps/*/lifecycle",async route=>{
  const id=route.request().url().split("/").at(-2)!;const body=route.request().postDataJSON();calls.push({id,action:body.action});
  if(id.startsWith("c"))return route.fulfill({status:403,json:{code:"host_required"}});
  if(body.action==="end")apps=apps.filter(a=>a.id!==id);
  return route.fulfill({json:{ok:true}});
 });
 await page.goto("/my-apps");await expect(page.getByTestId("my-app")).toHaveCount(3);
 return calls;
}
test("dashboard filters, sorts and keeps overview independent of filters on mobile",async({page},testInfo)=>{
 await page.setViewportSize({width:390,height:844});await setup(page);
 const stats=page.getByRole("region",{name:"Tổng quan ứng dụng"});
 await expect(stats).toContainText("3");await expect(stats).toContainText("2");
 await page.getByRole("searchbox",{name:"Tìm theo tên hoặc mã app"}).fill("khao sat");await expect(page.getByTestId("my-app")).toHaveCount(1);
 await page.getByRole("searchbox").fill("");await page.getByRole("combobox",{name:"Trạng thái",exact:true}).selectOption("closed");await expect(page.getByTestId("my-app")).toHaveCount(1);
 await page.getByRole("combobox",{name:"Trạng thái",exact:true}).selectOption("all");await page.getByRole("combobox",{name:"Hạn sử dụng",exact:true}).selectOption("soon");await expect(page.getByTestId("my-app")).toHaveCount(2);
 await page.getByRole("combobox",{name:"Sắp xếp",exact:true}).selectOption("title");await expect(page.getByTestId("my-app").first()).toContainText("Bình chọn");
 await page.getByRole("searchbox").fill("no-match");await expect(page.getByText("Không có app phù hợp bộ lọc.")).toBeVisible();await page.getByRole("button",{name:"Xóa bộ lọc"}).click();await expect(page.getByTestId("my-app")).toHaveCount(3);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:testInfo.outputPath("dashboard-mobile.png"),fullPage:true});
});
test("bulk end confirms, preserves failed selections and never submits hidden selections",async({page})=>{
 const calls=await setup(page);
 await page.getByLabel("Chọn tất cả kết quả").check();
 page.once("dialog",dialog=>dialog.dismiss());await page.getByRole("button",{name:"Kết thúc",exact:true}).first().click();expect(calls).toHaveLength(0);
 page.once("dialog",dialog=>dialog.accept());await page.getByRole("button",{name:"Kết thúc",exact:true}).first().click();
 await expect(page.getByText(/Thành công: 2. Thất bại: 1./)).toBeVisible();expect(calls).toHaveLength(3);await expect(page.getByTestId("my-app")).toHaveCount(1);await expect(page.getByLabel("Chọn app: Bình chọn món ăn")).toBeChecked();
 await page.getByRole("searchbox").fill("no-match");await page.getByRole("searchbox").fill("");await expect(page.getByLabel("Chọn app: Bình chọn món ăn")).not.toBeChecked();
});
test("bulk extension uses host-session and reports partial failures",async({page})=>{
 const calls=await setup(page);await page.getByLabel("Chọn tất cả kết quả").check();
 const request=page.waitForRequest(r=>r.url().includes("/lifecycle"));await page.getByRole("button",{name:"Thêm 7 ngày",exact:true}).first().click();
 expect((await request).headers()["x-host-session"]).toBe("1");await expect(page.getByText(/Thành công: 2. Thất bại: 1./)).toBeVisible();expect(calls.every(c=>c.action==="extend")).toBe(true);
});
for(const width of [320,1280])test(`my apps shares home branding and keeps controls usable at ${width}px`,async({page},testInfo)=>{
 await page.setViewportSize({width,height:900});await setup(page);
 await expect(page.getByRole("banner").getByRole("link",{name:/minintapp/i})).toBeVisible();
 await expect(page.getByRole("heading",{name:"App của tôi",exact:true})).toBeVisible();
 await expect(page.getByRole("link",{name:"Tạo app mới",exact:true})).toBeInViewport();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 for(const control of await page.locator("main button,main select,main input[type=search],main a").all()){
  const box=await control.boundingBox();expect(box?.height).toBeGreaterThanOrEqual(44);
 }
 await page.screenshot({path:testInfo.outputPath(`my-apps-${width}.png`),fullPage:true});
});
test("empty account offers a clear create action",async({page})=>{
 await page.route("**/api/engine/auth/session",route=>route.fulfill({json:{user:{email:"host@example.test"},accountsEnabled:true}}));
 await page.route("**/api/engine/account",route=>route.fulfill({json:{ok:true,email:"host@example.test",apps:[]}}));
 await page.goto("/my-apps");await expect(page.getByText("Chưa có app nào trong tài khoản.",{exact:false})).toBeVisible();
 await expect(page.getByRole("link",{name:"Tạo app mới",exact:true})).toHaveCount(2);
});
