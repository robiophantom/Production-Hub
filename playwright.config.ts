import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node scripts/e2e-server.mjs",
    url: `${baseURL}/login`,
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      PGLITE_DATA_DIR: ".data/e2e-pgdata",
      SEED_DEMO_DATA: "true",
      AUTH_SECRET: "e2e-local-secret-not-for-production",
      NEXT_PUBLIC_APP_URL: baseURL,
      BUSINESS_TIMEZONE: "Asia/Kolkata",
      AI_CLASSIFICATION_ENABLED: "false",
      AI_VOICE_ENABLED: "false",
    },
  },
});
