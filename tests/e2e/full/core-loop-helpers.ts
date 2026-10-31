// Shared steps for the core-loop e2e specs: a host browser plus separate "phones" (isolated contexts
// with a mobile viewport, each with its own participant token), driven through the real UI.
import { expect, devices, type Browser, type Page } from "@playwright/test";

export interface HostedApp {
  host: Page;
  hostUrl: string;
  appUrl: string;
}

/** Host opens a template from the home gallery and lands on its host screen. */
export async function hostFromTemplate(host: Page, templateTitle: string): Promise<HostedApp> {
  await host.goto("/templates");
  await host.locator(".template-card", { hasText: templateTitle }).click();
  await host.waitForURL(/\/rooms\/[^/]+\/host$/);
  const appUrl = await host.getByRole("link", { name: "Mở như người tham gia" }).getAttribute("href");
  expect(appUrl).toBeTruthy();
  return { host, hostUrl: host.url(), appUrl: appUrl! };
}

/** A phone joins by link (like scanning the QR), entering a display name when the app asks for one. */
export async function openPhone(browser: Browser, appUrl: string, name: string): Promise<Page> {
  const context = await browser.newContext({ ...devices["Pixel 7"], locale: "vi-VN" });
  const phone = await context.newPage();
  await phone.goto(appUrl);
  await enterNameIfAsked(phone, name);
  return phone;
}

/** Apps that list people by name ask once; a remembered name skips the form. */
export async function enterNameIfAsked(phone: Page, name: string): Promise<void> {
  // The app title and the name form render together once the state has loaded.
  await phone.locator("main h1").waitFor();
  const nameBox = phone.getByLabel("Tên hiển thị");
  if (await nameBox.isVisible()) {
    await nameBox.fill(name);
    await phone.getByRole("button", { name: "Tiếp tục" }).click();
  }
}

/** Option buttons of a choice/slot/person input (role radio for single choice, pressed buttons for multi). */
export const option = (page: Page, label: string) => page.locator(".opt", { hasText: label }).first();
