import type { Page } from "@playwright/test";
export async function mockReadyPlan(page: Page) {
  await page.route("**/api/engine/plan", async route => {
    const input = route.request().postDataJSON();
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ status: "ready", message: "Yêu cầu đã đủ rõ. Hãy xem lại và xác nhận.", suggestions: [], brief: input.messages[0].content }) });
  });
}
