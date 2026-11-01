import {expect,test} from "@playwright/test";
test("live demo supports local voting, quiz tabs and reset",async({page})=>{
 await page.goto("/preview");await expect(page).toHaveURL(/\/how-it-works#live-demo$/);
 await page.getByRole("radio",{name:"Trà",exact:true}).check();await page.getByRole("button",{name:"Gửi câu trả lời",exact:true}).click();
 await expect(page.getByRole("status").filter({hasText:"Đã ghi nhận lựa chọn của bạn."})).toBeVisible();
 const poll=page.getByRole("tab",{name:"Bình chọn",exact:true});await poll.focus();await page.keyboard.press("ArrowRight");
 await expect(page.getByRole("tab",{name:"Quiz",exact:true})).toBeFocused();await page.getByRole("button",{name:"Hai",exact:false}).click();
 await expect(page.getByRole("status").filter({hasText:"Chính xác!"})).toBeVisible();
 await poll.click();await expect(page.getByRole("radio",{name:"Trà",exact:true})).toBeChecked();await page.getByRole("button",{name:"Thử lại từ đầu",exact:false}).click();await expect(page.getByRole("radio",{name:"Trà",exact:true})).not.toBeChecked();
 await expect(page.getByRole("img",{name:"Mã QR mở ứng dụng"})).toBeVisible();
});
test("guide contains no disconnected feature placeholders and fits mobile",async({page})=>{
 await page.setViewportSize({width:320,height:844});await page.goto("/how-it-works");
 await expect(page.getByText("Chức năng tạo ứng dụng chưa kết nối API.")).toHaveCount(0);
 await expect(page.getByText("Các điểm mở rộng chưa khả dụng")).toHaveCount(0);
 await expect(page.getByRole("link",{name:/example.com/})).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:"test-results/guide-mobile.png",fullPage:true});
});
test("guide demo supports Japanese and English",async({page,context})=>{
 await context.addCookies([{name:"minint-locale",value:"ja",url:"http://127.0.0.1:3100"}]);await page.goto("/how-it-works");
 await expect(page.getByRole("heading",{level:1})).toContainText("アイデアから");await page.getByRole("radio",{name:"お茶",exact:true}).check();await page.getByRole("button",{name:"回答を送信",exact:false}).click();await expect(page.getByRole("status").filter({hasText:"選択を記録しました。"})).toBeVisible();
 await page.locator(".locale-switcher select").selectOption("en");await expect(page.getByRole("heading",{level:1})).toContainText("From an idea");await expect(page.getByRole("radio",{name:"Tea",exact:true})).toBeChecked();
});
