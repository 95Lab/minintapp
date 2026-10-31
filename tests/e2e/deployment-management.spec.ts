import { expect, test } from "@playwright/test";
const id = "a".repeat(24), image1 = `ghcr.io/95lab/minintapp@sha256:${"1".repeat(64)}`, image2 = `ghcr.io/95lab/minintapp@sha256:${"2".repeat(64)}`;
test.beforeEach(async ({page}) => {
  await page.route("**/api/engine/auth/session",route=>route.fulfill({json:{user:{email:"host@example.test"},accountsEnabled:true}}));
});

test("owner deploys and rolls back per-app versions and can inspect archived logs on mobile", async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  const now = new Date().toISOString();
  let details = { state:"RUNNING",activeVersion:1,requestedVersion:null as number|null,versions:[{version:1,image:image1,specDigest:"digest",status:"SUCCEEDED",previousVersion:null as number|null,rollbackOf:null as number|null,createdAt:now,completedAt:now}],images:[image1,image2],logs:[{id:"1",at:now,source:"deployment",message:"state: RUNNING"}],runtimeLogsAvailable:false };
  const calls: unknown[] = [];
  await page.route("**/api/my-apps",route=>route.fulfill({json:{apps:[{id,state:"RUNNING",hostname:`${id}.example.test`,created_at:now,expires_at:new Date(Date.now()+3600000).toISOString()}]}}));
  await page.route(`**/api/apps/${id}/deployment*`,async route=>{
    if(route.request().method()==="GET")return route.fulfill({json:details});
    const body=route.request().postDataJSON();calls.push(body);
    const version=details.versions.length+1;
    details={...details,activeVersion:version,versions:[{version,image:body.action==="rollback"?image1:image2,specDigest:"digest",status:"SUCCEEDED",previousVersion:details.activeVersion,rollbackOf:body.action==="rollback"?body.version:null,createdAt:now,completedAt:now},...details.versions]};
    return route.fulfill({json:{ok:true}});
  });
  await page.goto("/dashboard");await page.addStyleTag({content:".mini-card { font-family: Arial, sans-serif; }"});await page.getByRole("button",{name:"Phiên bản và log",exact:true}).click();
  await expect(page.getByText("Phiên bản đang chạy: v1")).toBeVisible();
  await expect(page.getByLabel("Nhật ký ứng dụng",{exact:true})).toContainText("state: RUNNING");
  await expect(page.getByText("Log runtime hiện không khả dụng; đang hiển thị log đã lưu.")).toBeVisible();
  await page.getByLabel("Image đã duyệt").selectOption(image2);await page.getByRole("button",{name:"Triển khai phiên bản",exact:true}).click();
  await expect(page.getByText("Phiên bản đang chạy: v2")).toBeVisible();
  await page.getByRole("button",{name:"Quay về v1",exact:true}).click();await expect(page.getByText("Phiên bản đang chạy: v3")).toBeVisible();
  expect(calls).toEqual([{action:"deploy",image:image2,expectedVersion:1},{action:"rollback",version:1,expectedVersion:2}]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test("pending deployment disables further changes and shows request failures", async ({page}) => {
  const now=new Date().toISOString();
  await page.route("**/api/my-apps",route=>route.fulfill({json:{apps:[{id,state:"DEPLOYING",hostname:`${id}.example.test`,created_at:now,expires_at:now}]}}));
  await page.route(`**/api/apps/${id}/deployment*`,route=>route.fulfill({json:{state:"DEPLOYING",activeVersion:1,requestedVersion:2,versions:[],images:[image1,image2],logs:[],runtimeLogsAvailable:false}}));
  await page.goto("/dashboard");await page.addStyleTag({content:".mini-card { font-family: Arial, sans-serif; }"});await page.getByRole("button",{name:"Phiên bản và log",exact:true}).click();
  await expect(page.getByText(/Đang triển khai v2/)).toBeVisible();await expect(page.getByRole("button",{name:"Triển khai phiên bản",exact:true})).toBeDisabled();
  await page.route(`**/api/apps/${id}/deployment*`,route=>route.fulfill({status:403,json:{code:"forbidden"}}));
  await page.getByRole("button",{name:"Làm mới log và phiên bản"}).click();await expect(page.getByRole("alert").filter({hasText:"Không thể tải hoặc thay đổi phiên bản"})).toContainText("Không thể tải hoặc thay đổi phiên bản");
});
