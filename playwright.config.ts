import { defineConfig, devices } from "@playwright/test";

// End-to-end tests against the DEPLOYED frontend (GitHub Pages) and backend (softala).
// Override the addresses with FRONTEND_URL and API_URL, e.g. to test a local build.
export default defineConfig({
  testDir: "./e2e",
  // the tests share one real database, so run them one at a time
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "e2e-report" }]],
  use: {
    baseURL: process.env.FRONTEND_URL ?? "https://kolehmainen-works.github.io/bookstorefrontend.github.io/",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
