import {expect,test} from "@playwright/test";
test("advanced custom name validates availability and is submitted with a template",async({page})=>{
 await page.route("**/api/subdomains*",route=>{const name=new URL(route.request().url()).searchParams.get("name");return route.fulfill({json:{supported:true,domain:"minintapp.io.vn",...(name?{available:name!=="taken-app",name}:{})}});});
 await page.route("**/api/engine/apps/from-template",route=>route.fulfill({status:409,json:{code:"subdomain_taken"}}));
 await page.goto("/templates");await expect(page.getByText("Tính năng nâng cao",{exact:true})).toBeVisible();
 const mode=page.getByRole("combobox",{name:"Địa chỉ ứng dụng",exact:true});await mode.selectOption("custom");
 const name=page.getByRole("textbox",{name:"Tên subdomain",exact:true});await name.fill("www");await expect(page.getByRole("status").filter({hasText:"Tên không hợp lệ"})).toBeVisible();
 await expect(page.locator(".template-card").first()).toBeDisabled();
 await name.fill("taken-app");await expect(page.getByRole("status").filter({hasText:"Tên đã được sử dụng"})).toBeVisible();
 await name.fill("my-workshop");await expect(page.getByRole("status").filter({hasText:"Tên này có thể sử dụng"})).toBeVisible();
 const request=page.waitForRequest(r=>r.method()==="POST"&&r.url().includes("from-template"));await page.locator(".template-card").first().click();expect((await request).postDataJSON()).toMatchObject({subdomain:"my-workshop"});
 await expect(page.locator("main").getByRole("alert")).toContainText("Tên subdomain đã được sử dụng");
 await mode.selectOption("random");await expect(page.getByRole("textbox",{name:"Tên subdomain",exact:true})).toHaveCount(0);
});
