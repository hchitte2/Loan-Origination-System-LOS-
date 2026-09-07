import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://localhost:3000";

/**
 * End-to-end journeys run locally against the dev server and the Neon `dev` branch
 * (after /db-reset once the schema exists). CI runs biome, tsc and vitest only, by design.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
