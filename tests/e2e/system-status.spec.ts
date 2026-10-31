import {expect,test} from "@playwright/test";
test("home shows real health status and component library in mobile menu in both languages",async({page})=>{
 await page.setViewportSize({width:320,height:844});
 await page.route("**/api/health",route=>route.fulfill({json:{status:"ok",service:"minintapp"}}));
 await page.goto("/");
 await expect(page.getByRole("status").filter({hasText:"Hệ thống hoạt động bình thường"})).toBeVisible();
 const header=page.getByRole("banner");await header.getByRole("button",{name:"Mở menu",exact:true}).click();
 await expect(header.getByRole("link",{name:"Thư viện component",exact:true})).toHaveAttribute("href","/preview");
 await header.getByRole("button",{name:"EN",exact:true}).click();
 await expect(header.getByRole("link",{name:"Component library",exact:true})).toBeVisible();
 await expect(page.getByRole("status").filter({hasText:"System operating normally"})).toBeVisible();
 await expect(page.getByRole("link",{name:"View details"})).toHaveAttribute("href","/api/health");
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
for(const status of ["unavailable","invalid"])test(`health ${status} never displays a healthy message`,async({page})=>{
 await page.route("**/api/health",route=>route.fulfill({status:status==="unavailable"?503:200,json:{status}}));
 await page.goto("/");
 await expect(page.getByRole("status").filter({hasText:status==="unavailable"?"Hệ thống tạm thời gián đoạn":"Chưa thể xác nhận trạng thái hệ thống"})).toBeVisible();
 await expect(page.getByText("Hệ thống hoạt động bình thường",{exact:true})).toHaveCount(0);
});
test("unreachable health check shows unknown instead of healthy",async({page})=>{
 await page.route("**/api/health",route=>route.abort());await page.goto("/");
 await expect(page.getByRole("status").filter({hasText:"Chưa thể xác nhận trạng thái hệ thống"})).toBeVisible();
});
