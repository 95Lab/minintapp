import { expect, test } from "@playwright/test";
test("exchanges the PKCE code, clears the callback URL and claims browser apps", async ({page})=>{
 let exchanged:unknown,claimed:unknown;
 await page.route("**/api/engine/auth/session",async route=>{
  if(route.request().method()==="POST"){exchanged=route.request().postDataJSON();await route.fulfill({json:{ok:true}});}
  else await route.fulfill({json:{accountsEnabled:true,user:{email:"test@example.test"}}});
 });
 await page.route("**/api/engine/account/claim",async route=>{claimed=route.request().postDataJSON();await route.fulfill({json:{ok:true,claimed:[]}});});
 await page.route("**/api/engine/account",route=>route.fulfill({json:{email:"test@example.test",apps:[]}}));
 await page.goto("/auth/callback?code=one-use-code&sb_flow_id=test-flow");
 await page.waitForURL("**/my-apps");
 expect(exchanged).toEqual({code:"one-use-code",flowId:"test-flow"});expect(claimed).toEqual({apps:[]});
 expect(page.url()).not.toContain("one-use-code");
});
test("an invalid callback offers a fresh sign-in without exchanging arbitrary access tokens",async({page})=>{
 await page.goto("/auth/callback#access_token=untrusted-token");
 await expect(page.getByRole("link",{name:"Gửi lại link"}).last()).toBeVisible();
 expect(page.url()).not.toContain("untrusted-token");
});
