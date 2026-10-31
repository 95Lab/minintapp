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
    command: "npm run start:standalone",
    env: { PORT: "3100", HOSTNAME: "127.0.0.1", APP_STORAGE: "memory", LIVE_DATA: "off", OPENAI_API_KEY: "", SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "", NEXT_PUBLIC_SUPABASE_URL: "https://realtime-test.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_browser_test" }, url: "http://127.0.0.1:3100/api/health",
    reuseExistingServer: false, timeout: 60_000,
  },
});
