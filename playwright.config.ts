import { defineConfig, devices } from "@playwright/test";
// Keep local health probes out of corporate HTTP proxies.
process.env.NO_PROXY = [process.env.NO_PROXY, process.env.no_proxy, "127.0.0.1", "localhost"].filter(Boolean).join(",");
process.env.no_proxy = process.env.NO_PROXY;
export default defineConfig({
  testDir: "./tests/e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run start -- --port 3100", url: "http://127.0.0.1:3100/api/health",
    reuseExistingServer: false, timeout: 60_000,
  },
});
