import { defineConfig, devices } from "@playwright/test";
import { config as loadDotenv } from "dotenv";

// Specs read the showcase token the same way the app does. `next dev` loads .env.local
// for itself; the test process has to be told.
loadDotenv({ path: ".env.local", quiet: true });

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
  // These run against `next dev`, which compiles a route the first time it is asked for.
  // Under parallel workers that regularly outruns the 5 s default and fails a healthy
  // assertion, so the floor is raised rather than sprinkling waits through the specs.
  expect: { timeout: 15_000 },
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
